import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { verifySenderDomain } from "../_shared/sender-domain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProspectData {
  id: string;
  businessName: string;
  contactName?: string;
  email: string;
  location?: string;
  services?: string;
  notes?: string;
}

interface BatchEmailRequest {
  prospects?: ProspectData[];
  emailType?: string;
  queueOnly?: boolean;
  sendAllFromDb?: boolean;
  offset?: number;
  limit?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prospects: inputProspects, emailType = 'introduction', queueOnly = false, sendAllFromDb = false, offset = 0, limit = 15 }: BatchEmailRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let validProspects: ProspectData[] = [];

    if (sendAllFromDb) {
      // Query prospects directly from DB in chunks
      const { data: dbProspects, error: dbError } = await supabase
        .from("prospects")
        .select("id, business_name, contact_name, email, location, services, notes")
        .not("email", "is", null)
        .like("email", "%@%")
        .eq("do_not_contact", false)
        .eq("unsubscribed", false)
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: true });

      if (dbError) throw new Error(`DB query error: ${dbError.message}`);
      if (!dbProspects || dbProspects.length === 0) {
        return new Response(JSON.stringify({ success: true, done: true, summary: { total: 0, queued: 0, sent: 0 } }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check which prospects already have campaign emails in queue or sent
      const prospectIds = dbProspects.map(p => p.id);
      const { data: existingQueue } = await supabase
        .from("outreach_queue")
        .select("prospect_id")
        .in("prospect_id", prospectIds)
        .eq("email_type", emailType);
      const { data: existingSent } = await supabase
        .from("sent_emails")
        .select("prospect_id")
        .in("prospect_id", prospectIds)
        .eq("email_type", emailType);

      const alreadyProcessed = new Set([
        ...(existingQueue || []).map(e => e.prospect_id),
        ...(existingSent || []).map(e => e.prospect_id),
      ]);

      validProspects = dbProspects
        .filter(p => !alreadyProcessed.has(p.id))
        .map(p => ({
          id: p.id,
          businessName: p.business_name,
          contactName: p.contact_name || undefined,
          email: p.email!,
          location: p.location || undefined,
          services: p.services || undefined,
          notes: p.notes || undefined,
        }));

      console.log(`Batch ${offset}-${offset + limit}: ${dbProspects.length} from DB, ${validProspects.length} new to process`);
    } else {
      if (!inputProspects || !Array.isArray(inputProspects) || inputProspects.length === 0) {
        return new Response(JSON.stringify({ error: "No prospects provided" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      validProspects = inputProspects.filter(p => p.email && p.email.includes('@'));
    }

    if (validProspects.length === 0) {
      return new Response(JSON.stringify({ success: true, done: sendAllFromDb, summary: { total: 0, queued: 0, sent: 0, skipped: sendAllFromDb ? limit : 0 } }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out unsubscribed prospects (for non-DB mode)
    if (!sendAllFromDb) {
      const prospectIds = validProspects.map(p => p.id).filter(Boolean);
      if (prospectIds.length > 0) {
        const { data: unsubscribedProspects } = await supabase
          .from("prospects")
          .select("id")
          .in("id", prospectIds)
          .or("unsubscribed.eq.true,do_not_contact.eq.true");
        if (unsubscribedProspects && unsubscribedProspects.length > 0) {
          const blockedIds = new Set(unsubscribedProspects.map(p => p.id));
          validProspects = validProspects.filter(p => !blockedIds.has(p.id));
        }
      }
    }

    if (validProspects.length === 0) {
      return new Response(JSON.stringify({ success: true, done: true, summary: { total: 0, queued: 0, sent: 0 } }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!OPENAI_API_KEY || (!RESEND_API_KEY && !queueOnly)) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify sender domain in Resend before sending. Skip when only queueing
    // (no actual send happens) so generation jobs aren't blocked.
    if (!queueOnly) {
      const senderStatus = await verifySenderDomain();
      if (!senderStatus.ok) {
        console.error("Sender domain not verified, aborting batch send:", senderStatus);
        return new Response(
          JSON.stringify({
            error: senderStatus.message,
            code: "sender_domain_not_verified",
            senderStatus,
          }),
          { status: 412, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`Processing ${validProspects.length} prospects (queueOnly=${queueOnly})`);

    const results: { email: string; success: boolean; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    const detectCategory = (name: string, notes?: string): string => {
      const text = `${name} ${notes || ''}`.toLowerCase();
      if (text.match(/crm|hubspot|salesforce|zoho|pipedrive/)) return "saas_crm";
      if (text.match(/quickbooks|xero|freshbooks|accounting software|payroll/)) return "saas_accounting";
      if (text.match(/voip|telecom|phone system|ringcentral|dialpad/)) return "saas_phone";
      if (text.match(/utility|electric.*company|gas.*company|water.*company/)) return "utility";
      if (text.match(/city hall|county|water district|public works|housing authority|transit|school district|government|municipal/)) return "government";
      if (text.match(/marketing.*agenc|digital.*agenc/)) return "agency";
      return "service_business";
    };

    const detectContactType = (notes?: string): string => {
      const role = (notes || '').match(/Contact role:\s*([^\n.]+)/i)?.[1]?.toLowerCase() || '';
      if (role.match(/owner|founder|ceo|president/)) return "owner";
      if (role.match(/partner|bd|bizdev|alliance/)) return "partnerships";
      if (role.match(/hr|human resource|people|talent/)) return "hr";
      if (role.match(/ir|investor|cfo/)) return "investor_relations";
      if (role.match(/coo|vp|director|manager/)) return "decision_maker";
      if (role.match(/city manager|administrator|clerk/)) return "government_official";
      return "general";
    };

    const getValueProp = (cat: string): string => {
      const props: Record<string, string> = {
        saas_crm: "Our AI phone agent picks up every call your customers' teams miss, qualifies the lead, books the appointment, and logs it. There is a real partnership angle here for native CRM integration.",
        saas_accounting: "Service businesses on your platform lose jobs every time the phone rings unanswered. Our AI picks up, captures the job details, and the data would pair naturally with invoicing.",
        saas_phone: "When your customers' lines are busy or closed, callers move on. Our AI sits on top as the overflow and after-hours layer. Could be a strong add-on for your users.",
        utility: "During outages and billing cycles, your phones get crushed and hold times spike. Our AI handles the routine calls instantly so your staff can focus on the hard ones.",
        government: "When residents can't get through, trust erodes. Our AI handles the routine calls 24/7 so your staff can focus on the work that needs a human.",
        agency: "Your clients lose customers every time a call goes to voicemail. Our AI picks up, books the appointment, and sends quotes in real time. Solid white-label or referral fit.",
        service_business: "When the phone rings and nobody picks up, that customer calls the next business on Google. Our AI picks up every call, books the appointment, and transfers to your team when someone asks for a person.",
      };
      return props[cat] || props.service_business;
    };

    const getCTA = (ct: string): string => {
      const ctas: Record<string, string> = {
        owner: "Open to a quick risk-free demo on a real number we set up for your business so you can hear it handle your calls? Call or text me at (702) 863-3200.",
        partnerships: "Worth a quick call to see if there is a partnership fit? My cell is (702) 863-3200, call or text any time.",
        investor_relations: "Happy to share more about what we are building. Call or text me at (702) 863-3200 whenever works.",
        hr: "Could you point me to whoever runs operations or phones? Or just have them call or text me at (702) 863-3200.",
        government_official: "Open to a risk-free demo on a real number for your department? Call or text me at (702) 863-3200.",
        general: "If this sounds worth exploring, call or text me at (702) 863-3200 and I will set up a risk-free live demo on a real number for your business.",
      };
      return ctas[ct] || ctas.general;
    };

    for (const prospect of validProspects) {
      try {
        const bizCategory = detectCategory(prospect.businessName, prospect.notes);
        const contactType = detectContactType(prospect.notes);
        const valueProp = getValueProp(bizCategory);
        const cta = getCTA(contactType);
        const greeting = prospect.contactName ? `Hi ${prospect.contactName.split(' ')[0]},` : `Hi ${prospect.businessName} team,`;

        const contextParts: string[] = [];
        if (prospect.businessName) contextParts.push(`Business: ${prospect.businessName}`);
        if (prospect.contactName) contextParts.push(`Contact: ${prospect.contactName}`);
        if (prospect.location) contextParts.push(`Location: ${prospect.location}`);
        if (prospect.services) contextParts.push(`Services: ${prospect.services}`);
        if (prospect.notes) contextParts.push(`Notes: ${prospect.notes}`);

        const purposeDesc = bizCategory === "service_business" ? "service business we want as a client" : bizCategory.startsWith("saas") ? "SaaS company we want as an integration partner" : bizCategory === "government" ? "government agency" : bizCategory === "utility" ? "utility company" : bizCategory === "agency" ? "agency we want as a referral partner" : "business";

        const isCampaign = emailType === 'campaign_500_free';

        const campaignSystemPrompt = `You are Alex Perez, founder of Automate Planet (Las Vegas AI communications company). You are writing a personal campaign email offering a RISK-FREE LIVE DEMO plus 500 free calls if they want to keep going.

THE EMAIL MUST:
- Open with: "${greeting}"
- Reference one specific thing about their business or industry in the first sentence
- Make the offer clear: a real phone number set up for their business so they can call it and hear the AI work, plus 500 free calls if they want it, no credit card, no commitment, walk away if it is not a fit
- End with this CTA: "Call or text me at (702) 863-3200 and I'll get the demo line set up for you today."
- Close with the signature: "Alex Perez\\nAutomate Planet | (702) 863-3200"
- Add a P.S. line emphasizing zero risk: no credit card, no commitment, walk away if it's not a fit

WEAVE IN AT MOST 2 features (pick the most relevant to their business):
- Answers every call 24/7 in under 1 second
- Speaks 72+ languages
- Books appointments and captures leads during live calls
- Transfers to a real person when asked

RULES:
- 60-90 words before the signature.
- Conversational, founder to founder. Never salesy.
- ONE CTA only: call or text (702) 863-3200. NO links.
- NO em dashes, NO bullet points, NO "I noticed", "I came across", "I hope this finds you well"
- NO jargon: "leverage", "optimize", "streamline", "synergy"
- Subject line: 3-5 words, sentence case, curiosity-led. Do NOT include "demo", "AI", "free", or the business name.
- If it could be sent to anyone else, REWRITE it.

Return JSON: {"subject": "...", "body": "..."}`;

        const regularSystemPrompt = `You are Alex Perez, founder of Automate Planet (Las Vegas AI communications company). Every email is UNIQUELY tailored to THIS recipient.

THE EMAIL MUST:
- Open with: "${greeting}"
- Include this value prop tailored to their situation: "${valueProp}"
- End the body with this CTA: "${cta}"
- Close with the signature: "Alex Perez\\nAutomate Planet | (702) 863-3200"
- Add a P.S. line offering a risk-free live demo on a dedicated phone number set up for their business. Wording must vary, but always communicate: no credit card, no commitment, walk away if it's not a fit, and to call or text Alex at (702) 863-3200 to set it up.

POSITIONING:
- AI is BACKUP for their team, never a replacement
- When a caller asks for a person, AI transfers to a real human on their team
- Risk-free demo = a live number tied to their business they can call to hear it work

WRITING RULES (cold email best practices):
- 50-75 words before the signature. Shorter wins.
- One business owner texting another. Conversational, confident.
- Reference something specific about their business in the first sentence.
- ONE CTA only: call or text (702) 863-3200. NO links anywhere.
- The P.S. line carries the demo offer.
- NO em dashes. NO bullet points or lists.
- NO "I hope this finds you well", "I noticed", "I came across", "Just following up"
- NO jargon: "leverage", "optimize", "streamline", "synergy", "cutting-edge"
- Subject line: 3-5 words, sentence case, curiosity-led. Do NOT include "demo", "AI", "free", or the business name verbatim.
- If it could be sent to anyone else, REWRITE it.

Return JSON: {"subject": "...", "body": "..."}`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 800,
            messages: [
              { role: 'system', content: isCampaign ? campaignSystemPrompt : regularSystemPrompt },
              {
                role: 'user',
                content: `${isCampaign
                  ? `Write a personalized campaign email offering 500 free calls to this ${purposeDesc}:`
                  : `Write a personalized outreach email for this ${purposeDesc}:`}

${contextParts.join('\n')}
Business Category: ${bizCategory}
Contact Type: ${contactType}

Write an email that feels like it was written ONLY for ${prospect.contactName || prospect.businessName}. Return valid JSON.`
              }
            ],
          }),
        });

        if (!aiResponse.ok) throw new Error(`AI API error: ${aiResponse.status}`);

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        let emailData;
        try {
          let jsonString = content;
          if (jsonString.includes('```')) jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          emailData = JSON.parse(jsonString.trim());
        } catch {
          emailData = { subject: `AI Employees for ${prospect.businessName || 'Your Business'}`, body: content };
        }

        if (queueOnly) {
          // Insert into outreach_queue for later sending
          await supabase.from("outreach_queue").insert({
            prospect_id: prospect.id || null,
            to_email: prospect.email,
            subject: emailData.subject,
            body: emailData.body,
            email_type: emailType,
            status: "approved",
            notes: `Campaign: 500 Free Calls`,
          });
          results.push({ email: prospect.email, success: true });
          successCount++;
          console.log(`Queued email for ${prospect.email}`);
        } else {
          // Send directly via Resend
          const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(prospect.email)}`;
          const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">${emailData.body.split('\n').map((line: string) => line.trim() ? `<p style="margin: 0 0 16px 0;">${line}</p>` : '').join('')}<p style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a> from future emails</p></body></html>`;

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Alex Perez <marketing@automateplanet.com>",
              to: [prospect.email],
              subject: emailData.subject,
              html: htmlBody,
              reply_to: "alex@automateplanet.com",
            }),
          });

          const resendData = await emailResponse.json();
          if (!emailResponse.ok) throw new Error(resendData.message || 'Failed to send email');

          if (resendData.id) {
            await supabase.from("sent_emails").insert({
              resend_id: resendData.id,
              to_email: prospect.email,
              subject: emailData.subject,
              body: emailData.body,
              email_type: emailType,
              prospect_id: prospect.id || null,
              status: "sent",
            });
          }

          results.push({ email: prospect.email, success: true });
          successCount++;
          console.log(`Email sent to ${prospect.email}`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed for ${prospect.email}:`, errorMessage);
        results.push({ email: prospect.email, success: false, error: errorMessage });
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        done: sendAllFromDb ? validProspects.length < limit : true,
        nextOffset: sendAllFromDb ? offset + limit : undefined,
        results,
        summary: { total: validProspects.length, [queueOnly ? 'queued' : 'sent']: successCount, failed: failCount },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in batch-send-emails:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
