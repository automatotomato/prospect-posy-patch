import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    click?: {
      link: string;
      timestamp: string;
    };
    reply?: {
      text: string;
      html: string;
    };
  };
}

const OPT_OUT_KEYWORDS = [
  "stop", "unsubscribe", "remove", "opt out", "do not contact",
  "take me off", "no thanks", "not interested", "leave me alone",
];

const INTEREST_KEYWORDS = [
  "interested", "tell me more", "sounds good", "let's talk", "lets talk",
  "schedule", "call me", "send me info", "pricing", "quote",
  "how much", "set up a time", "love to learn", "would like to",
];

function classifyReply(replyText: string): "opt_out" | "interested" | "neutral" {
  const normalized = replyText.toLowerCase().trim();
  if (!normalized) return "neutral";
  // Opt-out first (safety priority — "not interested" is opt-out, not interest)
  if (OPT_OUT_KEYWORDS.some((kw) => normalized.includes(kw))) return "opt_out";
  if (INTEREST_KEYWORDS.some((kw) => normalized.includes(kw))) return "interested";
  return "neutral";
}

function extractReplyText(reply?: { text?: string; html?: string }): string {
  if (reply?.text) return reply.text;
  if (reply?.html) return reply.html.replace(/<[^>]*>/g, "");
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  // Verify Svix webhook signature from Resend
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

  if (webhookSecret) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response(JSON.stringify({ error: "Missing Svix signature headers" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify timestamp is within 5 minutes (replay attack prevention)
    const tsMs = parseInt(svixTimestamp, 10) * 1000;
    if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
      return new Response(JSON.stringify({ error: "Webhook timestamp too old" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify HMAC-SHA256 signature
    const payload = await req.clone().text();
    const toSign = `${svixId}.${svixTimestamp}.${payload}`;
    const secretBytes = Uint8Array.from(atob(webhookSecret.replace("whsec_", "")), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
    const computedSig = "v1," + btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
    const expectedSigs = svixSignature.split(" ");
    const valid = expectedSigs.some(s => s === computedSig);

    if (!valid) {
      console.error("Webhook signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    console.warn("RESEND_WEBHOOK_SECRET not configured — skipping signature verification");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Helper: cancel all pending outreach for a prospect
  const cancelPendingOutreach = async (prospectId: string) => {
    const results = await Promise.allSettled([
      supabase.from("outreach_queue").delete().eq("prospect_id", prospectId).in("status", ["pending", "queued", "approved"]),
      supabase.from("scheduled_follow_ups").delete().eq("prospect_id", prospectId).eq("status", "pending"),
      supabase.from("scheduled_emails").delete().eq("prospect_id", prospectId).eq("status", "pending"),
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`cancelPendingOutreach table ${i} error:`, r.reason);
    });
    console.log("Cancelled pending outreach for prospect:", prospectId);
  };

  try {
    const event: ResendWebhookEvent = await req.json();
    
    console.log("Received Resend webhook:", event.type, event.data.email_id);

    const resendId = event.data.email_id;
    if (!resendId) {
      console.log("No email_id in webhook payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the sent email record
    const { data: sentEmail, error: findError } = await supabase
      .from("sent_emails")
      .select("id, open_count, click_count, opened_at, clicked_at, to_email, subject, prospect_id, prospects(business_name)")
      .eq("resend_id", resendId)
      .maybeSingle();

    if (findError) console.error("Error finding sent email:", findError);

    if (!sentEmail) {
      // Skip writing unmatched events to the DB — they create write-only noise.
      // Log to function logs only for diagnostics.
      console.log("Unmatched webhook (skipped DB write):", event.type, resendId, "to:", event.data.to?.[0], "subject:", event.data.subject);
      return new Response(JSON.stringify({ received: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentOpenCount = sentEmail.open_count as number || 0;
    const currentClickCount = sentEmail.click_count as number || 0;
    const existingOpenedAt = sentEmail.opened_at as string | null;
    const existingClickedAt = sentEmail.clicked_at as string | null;
    const businessName = (sentEmail as any).prospects?.business_name || sentEmail.to_email;

    // Log the event
    await supabase.from("email_events").insert({
      sent_email_id: sentEmail.id,
      event_type: event.type,
      event_data: event.data,
    });

    // Update sent_emails based on event type
    const updates: Record<string, unknown> = {};

    // Helper: check and schedule follow-ups based on trigger
    const checkFollowUpRules = async (triggerCondition: string) => {
      try {
        const { data: rules, error: rulesError } = await supabase
          .from("follow_up_rules")
          .select("*")
          .eq("is_active", true)
          .eq("trigger_condition", triggerCondition);

        if (rulesError || !rules || rules.length === 0) {
          console.log(`No active rules for trigger: ${triggerCondition}`);
          return;
        }

        if (sentEmail.prospect_id) {
          const { data: prospectData } = await supabase
            .from("prospects")
            .select("unsubscribed")
            .eq("id", sentEmail.prospect_id)
            .single();

          if (prospectData?.unsubscribed) {
            console.log("Prospect is unsubscribed, skipping follow-up scheduling");
            return;
          }
        }

        for (const rule of rules) {
          const { data: existingFollowUp } = await supabase
            .from("scheduled_follow_ups")
            .select("id")
            .eq("sent_email_id", sentEmail.id)
            .eq("follow_up_rule_id", rule.id)
            .maybeSingle();

          if (existingFollowUp) {
            console.log(`Follow-up already scheduled for rule: ${rule.name}`);
            continue;
          }

          const scheduledFor = new Date();
          scheduledFor.setHours(scheduledFor.getHours() + rule.delay_hours);

          const { error: insertError } = await supabase
            .from("scheduled_follow_ups")
            .insert({
              sent_email_id: sentEmail.id,
              follow_up_rule_id: rule.id,
              prospect_id: sentEmail.prospect_id,
              scheduled_for: scheduledFor.toISOString(),
              status: "pending",
            });

          if (insertError) {
            console.error(`Error scheduling follow-up for rule ${rule.name}:`, insertError);
          } else {
            console.log(`Scheduled follow-up: ${rule.name} for ${scheduledFor.toISOString()}`);
          }
        }
      } catch (err) {
        console.error("Error checking follow-up rules:", err);
      }
    };

    switch (event.type) {
      case "email.opened":
        updates.open_count = currentOpenCount + 1;
        if (!existingOpenedAt) updates.opened_at = new Date().toISOString();
        updates.status = "opened";
        console.log("Email opened:", resendId);
        if (!existingOpenedAt && currentClickCount === 0) {
          await checkFollowUpRules("opened_not_clicked");
        }
        break;

      case "email.clicked":
        updates.click_count = currentClickCount + 1;
        if (!existingClickedAt) updates.clicked_at = new Date().toISOString();
        updates.status = "clicked";
        console.log("Email clicked:", resendId, event.data.click?.link);
        if (!existingClickedAt) {
          await checkFollowUpRules("clicked");
          await supabase.from("notifications").insert({
            type: "click",
            title: "Hot Lead — Email Clicked!",
            message: `${businessName} clicked a link in your email: "${sentEmail.subject}"`,
            data: { sent_email_id: sentEmail.id, prospect_id: sentEmail.prospect_id, from_email: sentEmail.to_email, subject: sentEmail.subject, link: event.data.click?.link },
          });
          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            try {
              await resend.emails.send({
                from: "Z Notifications <alex@automateplanet.com> C Notifications <management@z-cconsultants.com>",
                to: ["management@z-cconsultants.com"],
                subject: `🔥 Hot Lead — ${businessName} clicked your email`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#f59e0b;">Hot Lead — Email Clicked!</h2><p><strong>${businessName}</strong> just clicked a link in your email:</p><div style="background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:0;"><strong>Subject:</strong> ${sentEmail.subject}</p><p style="margin:8px 0 0;"><strong>Link clicked:</strong> ${event.data.click?.link || "Unknown"}</p></div><p>Strike while the iron is hot — reach out now!</p><a href="https://field-to-followup.lovable.app/outreach/sent" style="display:inline-block;background:#f59e0b;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:16px;">View in Dashboard</a></div>`,
              });
              console.log("Click notification email sent");
            } catch (emailError) {
              console.error("Error sending click notification email:", emailError);
            }
          }
        }
        break;

      case "email.delivered":
        updates.status = "delivered";
        console.log("Email delivered:", resendId);
        await checkFollowUpRules("not_opened");
        await checkFollowUpRules("no_response");
        break;

      case "email.bounced":
        updates.status = "bounced";
        console.log("Email bounced:", resendId);
        break;

      case "email.complained":
        updates.status = "complained";
        console.log("Email complained:", resendId);
        break;

      case "email.replied": {
        updates.status = "replied";
        updates.replied_at = new Date().toISOString();
        console.log("Email replied:", resendId);

        const replyText = extractReplyText(event.data.reply);
        const intent = classifyReply(replyText);
        console.log(`Reply intent: ${intent} | text: "${replyText.substring(0, 100)}"`);

        if (intent === "opt_out" && sentEmail.prospect_id) {
          // --- OPT-OUT FLOW ---
          console.log("Opt-out detected, flagging prospect as do-not-contact");
          await supabase
            .from("prospects")
            .update({
              do_not_contact: true,
              unsubscribed: true,
              do_not_contact_reason: `Auto-detected: replied "${replyText.substring(0, 50)}"`,
              status: "responded",
            })
            .eq("id", sentEmail.prospect_id);

          await cancelPendingOutreach(sentEmail.prospect_id);

          await supabase.from("notifications").insert({
            type: "opt_out",
            title: "Contact Opted Out",
            message: `${businessName} replied "${replyText.substring(0, 60)}" — added to do-not-contact list.`,
            data: { sent_email_id: sentEmail.id, prospect_id: sentEmail.prospect_id, from_email: sentEmail.to_email, subject: sentEmail.subject, reply_text: replyText.substring(0, 200) },
          });

        } else if (intent === "interested" && sentEmail.prospect_id) {
          // --- INTERESTED FLOW ---
          console.log("Interest detected, upgrading prospect to qualified");
          await supabase
            .from("prospects")
            .update({ status: "qualified" })
            .eq("id", sentEmail.prospect_id);

          await cancelPendingOutreach(sentEmail.prospect_id);

          await supabase.from("notifications").insert({
            type: "interest",
            title: "🔥 Hot Lead — Interested!",
            message: `${businessName} is interested! They replied: "${replyText.substring(0, 80)}"`,
            data: { sent_email_id: sentEmail.id, prospect_id: sentEmail.prospect_id, from_email: sentEmail.to_email, subject: sentEmail.subject, reply_text: replyText.substring(0, 500) },
          });

          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            try {
              await resend.emails.send({
                from: "Z Notifications <alex@automateplanet.com> C Notifications <management@z-cconsultants.com>",
                to: ["management@z-cconsultants.com"],
                subject: `🔥 Hot Lead — ${businessName} is interested!`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#22c55e;">🔥 Hot Lead — Interested!</h2><p><strong>${businessName}</strong> replied to your email and seems interested:</p><div style="background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:0;"><strong>Subject:</strong> ${sentEmail.subject}</p><p style="margin:8px 0 0;"><strong>Their reply:</strong></p><p style="margin:8px 0 0;white-space:pre-wrap;">${replyText.substring(0, 500)}</p></div><p>Follow up personally — they're warm!</p><a href="https://field-to-followup.lovable.app/outreach/sent" style="display:inline-block;background:#22c55e;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:16px;">View in Dashboard</a></div>`,
              });
              console.log("Interest notification email sent");
            } catch (emailError) {
              console.error("Error sending interest notification email:", emailError);
            }
          }

        } else {
          // --- NEUTRAL REPLY FLOW (existing behavior) ---
          await supabase.from("notifications").insert({
            type: "reply",
            title: "New Email Reply!",
            message: `${businessName} replied to your email: "${sentEmail.subject}"`,
            data: { sent_email_id: sentEmail.id, prospect_id: sentEmail.prospect_id, from_email: sentEmail.to_email, subject: sentEmail.subject },
          });

          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            try {
              await resend.emails.send({
                from: "Z Notifications <alex@automateplanet.com> C Notifications <management@z-cconsultants.com>",
                to: ["management@z-cconsultants.com"],
                subject: `🔔 Reply from ${businessName}`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#22c55e;">New Reply Received!</h2><p><strong>${businessName}</strong> replied to your email:</p><div style="background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:0;"><strong>Original Subject:</strong> ${sentEmail.subject}</p><p style="margin:8px 0 0;"><strong>From:</strong> ${sentEmail.to_email}</p></div><p>Check your inbox to continue the conversation!</p><a href="https://field-to-followup.lovable.app/outreach/sent" style="display:inline-block;background:#22c55e;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:16px;">View in Dashboard</a></div>`,
              });
              console.log("Reply notification email sent");
            } catch (emailError) {
              console.error("Error sending notification email:", emailError);
            }
          }

          if (sentEmail.prospect_id) {
            await supabase
              .from("prospects")
              .update({ status: "responded" })
              .eq("id", sentEmail.prospect_id);
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("sent_emails")
        .update(updates)
        .eq("id", sentEmail.id);
      if (updateError) console.error("Error updating sent email:", updateError);
    }

    // Trigger lead score recalc on engagement events
    if (sentEmail.prospect_id && ["email.opened","email.clicked","email.bounced","email.replied"].includes(event.type)) {
      supabase.functions.invoke("recalculate-lead-scores", {
        body: { prospect_ids: [sentEmail.prospect_id] },
      }).catch((e) => console.error("recalc invoke failed:", e));
    }

    // Trigger AI reply classifier on replies
    if (event.type === "email.replied" && sentEmail.prospect_id) {
      const replyText = extractReplyText(event.data.reply);
      const intent = classifyReply(replyText);
      if (intent !== "opt_out" && replyText) {
        supabase.functions.invoke("classify-and-draft-reply", {
          body: {
            prospect_id: sentEmail.prospect_id,
            sent_email_id: sentEmail.id,
            inbound_message_id: resendId,
            inbound_body: replyText,
            business_name: businessName,
          },
        }).catch((e) => console.error("classify invoke failed:", e));
      }
    }

    return new Response(
      JSON.stringify({ received: true, processed: event.type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
