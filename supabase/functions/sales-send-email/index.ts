import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { verifySenderDomain } from "../_shared/sender-domain.ts";
import { BRAND } from "../_shared/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  leadIds: string[];
  /** Minutes between each send. 0 / undefined = send all immediately. */
  dripIntervalMinutes?: number;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json(500, { error: "RESEND_API_KEY not configured" });

    const supabaseAuth = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await supabaseAuth.auth.getUser();
    if (uErr || !user) return json(401, { error: "Unauthorized" });

    const { leadIds, dripIntervalMinutes }: Body = await req.json();
    if (!Array.isArray(leadIds) || leadIds.length === 0)
      return json(400, { error: "leadIds required" });
    const dripMin = Math.max(0, Number(dripIntervalMinutes) || 0);

    // Check sender domain (non-blocking — restricted "sending only" keys can't read /domains)
    const sender = await verifySenderDomain();
    if (!sender.ok && sender.error !== "resend_401" && sender.error !== "resend_400")
      return json(412, { error: sender.message, code: "sender_domain_not_verified", sender });

    const supabase = createClient(SUPABASE_URL, SERVICE);
    const { data: leads, error: lErr } = await supabase
      .from("sales_leads")
      .select("*")
      .in("id", leadIds);
    if (lErr) return json(500, { error: lErr.message });

    const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

    for (const lead of leads || []) {
      if (!lead.email) { results.push({ id: lead.id, ok: false, reason: "no email" }); continue; }
      if (!lead.email_subject || !lead.email_body) {
        results.push({ id: lead.id, ok: false, reason: "no draft" }); continue;
      }

      const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(lead.email)}`;
      const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
${lead.email_body.split("\n").map((ln: string) => ln.trim() ? `<p style="margin:0 0 16px 0;">${ln}</p>` : "").join("")}
<div style="margin:28px 0 8px 0;text-align:center;">
<a href="${BRAND.bookingUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Book a 15-min call</a>
<div style="font-size:11px;color:#666;margin-top:8px;">Or reply to this email · <a href="tel:${BRAND.phone.replace(/[^0-9+]/g, "")}" style="color:#0f766e;text-decoration:none;">${BRAND.phone}</a></div>
</div>
<p style="margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center;">
<a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a> from future emails</p>
</body></html>`;

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: BRAND.fromHeader,
          to: [lead.email],
          subject: lead.email_subject,
          html: htmlBody,
          reply_to: BRAND.replyTo,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        results.push({ id: lead.id, ok: false, reason: data?.message || `HTTP ${r.status}` });
        continue;
      }

      const now = new Date().toISOString();
      const followUp = new Date(); followUp.setDate(followUp.getDate() + 4);
      await supabase.from("sales_leads").update({
        stage: "contacted",
        last_contacted_at: now,
        last_activity_at: now,
        contact_count: (lead.contact_count || 0) + 1,
        follow_up_at: followUp.toISOString(),
      }).eq("id", lead.id);

      await supabase.from("sales_activities").insert({
        lead_id: lead.id, owner_id: user.id, type: "email_sent",
        note: lead.email_subject, metadata: { resend_id: data?.id },
      });

      await supabase.from("sent_emails").insert({
        resend_id: data?.id, to_email: lead.email, subject: lead.email_subject,
        body: lead.email_body, email_type: "sales_outreach", status: "sent",
      });

      results.push({ id: lead.id, ok: true });
    }

    const sent = results.filter((r) => r.ok).length;
    return json(200, { sent, total: results.length, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: msg });
  }
});
