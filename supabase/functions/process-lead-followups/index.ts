// Hourly follow-up sender.
// Picks contacted leads whose `follow_up_at` is due, drafts a fresh follow-up
// with OpenAI, sends via Resend, and bumps the lead forward.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { BRAND } from "../_shared/brand.ts";
import { ZC_PROFILE } from "../_shared/zc-profile.ts";
import { verifySenderDomain } from "../_shared/sender-domain.ts";

const MAX_TOUCHES = 5;
const BATCH_SIZE = 60; // per invocation — enough headroom to top-up to daily floor
const SEND_SPACING_MS = 800;
const DAILY_FLOOR = 200; // hard minimum emails/day (follow-ups + first-touch top-up)

// Cadence in days by (upcoming) touch number. touch #2 = 4d after #1, etc.
const CADENCE_DAYS: Record<number, number> = { 2: 4, 3: 7, 4: 10, 5: 14 };

interface Lead {
  id: string;
  business_name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  notes: string | null;
  email: string;
  contact_count: number | null;
  last_contacted_at: string | null;
  follow_up_at: string | null;
  stage: string;
  owner_id: string | null;
}

async function draftFollowup(lead: Lead, touchNumber: number, openaiKey: string): Promise<{ subject: string; body: string } | null> {
  const system = `You are an SDR for Z & C Consultants writing a short, human follow-up email. Use ONLY the profile below.\n\n${ZC_PROFILE}`;
  const angle = touchNumber === 2
    ? "quick bump — reference the first note, offer a single concrete example tied to their industry"
    : touchNumber === 3
    ? "share a mini case-study-style one-liner (no fake logos), reframe the pain"
    : touchNumber === 4
    ? "acknowledge the silence, ask if timing is off or if someone else should be looped in"
    : "final soft close — say this is the last email, invite a reply if timing changes";

  const user = `Write follow-up #${touchNumber - 1} (out of ${MAX_TOUCHES - 1}) for:

Business: ${lead.business_name}
Industry: ${lead.industry || "unknown"}
Location: ${lead.city || ""}${lead.state ? ", " + lead.state : ""}
Website: ${lead.website || "n/a"}
${lead.notes ? "Notes: " + lead.notes : ""}

Angle for this touch: ${angle}.
Keep under 90 words. No "just checking in" clichés.
Return JSON: {"subject":"...","body":"..."}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    }),
  });
  if (!r.ok) {
    console.error("openai draft failed", r.status, await r.text());
    return null;
  }
  const j = await r.json();
  try {
    const parsed = JSON.parse(j.choices[0].message.content);
    if (!parsed.subject || !parsed.body) return null;
    return { subject: String(parsed.subject), body: String(parsed.body) };
  } catch (_e) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!RESEND_KEY) return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!OPENAI_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const sender = await verifySenderDomain();
  // Restricted "sending-only" keys can't read /domains — treat as OK and try sends anyway.
  if (!sender.ok && sender.error !== "resend_401" && sender.error !== "resend_400") {
    return new Response(JSON.stringify({ skipped: true, reason: sender.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Read caps from lead_costs. This function only sends follow-ups (touch>=2),
  // so it is bound by followup_daily_cap (default 150).
  let dailyCap = 200;
  let followupCap = 150;
  const { data: costsRow } = await supabase
    .from("lead_costs")
    .select("daily_send_cap, followup_daily_cap")
    .eq("id", "default")
    .maybeSingle();
  if (costsRow?.daily_send_cap) dailyCap = Number(costsRow.daily_send_cap) || 200;
  if (costsRow?.followup_daily_cap) followupCap = Number(costsRow.followup_daily_cap) || 150;

  // Count follow-up auto-sends in the last 24h (touch > 1).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("sales_activities")
    .select("metadata")
    .eq("type", "email_sent")
    .gte("created_at", since);
  const followupsSent = (recent || []).filter((r: any) => Number(r?.metadata?.touch ?? 1) > 1).length;
  const alreadySent = recent?.length ?? 0;
  const remaining = Math.max(0, followupCap - followupsSent);

  if (remaining <= 0) {
    return new Response(JSON.stringify({ ok: true, skipped: "followup_cap", followups_sent_24h: followupsSent, followup_cap: followupCap, daily_cap: dailyCap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const batchLimit = Math.min(BATCH_SIZE, remaining);
  const nowIso = new Date().toISOString();
  const { data: dueLeads, error } = await supabase
    .from("sales_leads")
    .select("id,business_name,industry,city,state,website,notes,email,contact_count,last_contacted_at,follow_up_at,stage,owner_id")
    .eq("stage", "contacted")
    .not("email", "is", null)
    .lte("follow_up_at", nowIso)
    .lt("contact_count", MAX_TOUCHES)
    .order("follow_up_at", { ascending: true })
    .limit(batchLimit);

  if (error) {
    console.error("query failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  for (const lead of (dueLeads as Lead[]) || []) {
    const nextTouch = (lead.contact_count || 1) + 1;
    if (nextTouch > MAX_TOUCHES) { results.push({ id: lead.id, ok: false, reason: "cap_reached" }); continue; }

    const draft = await draftFollowup(lead, nextTouch, OPENAI_KEY);
    if (!draft) { results.push({ id: lead.id, ok: false, reason: "draft_failed" }); continue; }

    const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(lead.email)}`;
    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
${draft.body.split("\n").map((ln) => ln.trim() ? `<p style="margin:0 0 16px 0;">${ln}</p>` : "").join("")}
<div style="margin:28px 0 8px 0;text-align:center;">
<a href="${BRAND.bookingUrl.replace(/&/g, "&amp;")}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Book a 15-min call</a>
<div style="font-size:11px;color:#666;margin-top:8px;">Or reply · <a href="tel:${BRAND.phone.replace(/[^0-9+]/g, "")}" style="color:#0f766e;text-decoration:none;">${BRAND.phone}</a></div>
</div>
<p style="margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center;">
<a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a> from future emails</p>
</body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: BRAND.fromHeader,
        to: [lead.email],
        subject: draft.subject,
        html,
        reply_to: BRAND.replyTo,
      }),
    });
    const respBody = await r.json().catch(() => ({}));
    if (!r.ok) {
      results.push({ id: lead.id, ok: false, reason: respBody?.message || `HTTP ${r.status}` });
      // If a hard "unsubscribed / bounced" style error, park lead
      if (r.status === 422 || r.status === 403) {
        await supabase.from("sales_leads").update({ stage: "unsubscribed", last_activity_at: nowIso }).eq("id", lead.id);
      }
      await new Promise((res) => setTimeout(res, SEND_SPACING_MS));
      continue;
    }

    const now = new Date();
    const gap = CADENCE_DAYS[nextTouch + 1] ?? 0;
    const next = gap > 0 ? new Date(now.getTime() + gap * 86_400_000).toISOString() : null;

    await supabase.from("sales_leads").update({
      contact_count: nextTouch,
      last_contacted_at: now.toISOString(),
      last_activity_at: now.toISOString(),
      follow_up_at: next,
      stage: "contacted",
    }).eq("id", lead.id);

    await supabase.from("sales_activities").insert({
      lead_id: lead.id,
      owner_id: lead.owner_id,
      type: "email_sent",
      note: `Follow-up #${nextTouch - 1}: ${draft.subject}`,
      metadata: { resend_id: respBody?.id, auto: true, touch: nextTouch },
    });

    await supabase.from("sent_emails").insert({
      resend_id: respBody?.id,
      to_email: lead.email,
      subject: draft.subject,
      body: draft.body,
      email_type: "sales_followup",
      status: "sent",
    });

    results.push({ id: lead.id, ok: true, touch: nextTouch, next_follow_up: next });
    await new Promise((res) => setTimeout(res, SEND_SPACING_MS));
  }

  return new Response(
    JSON.stringify({
      ok: true, ran_at: nowIso,
      considered: dueLeads?.length ?? 0,
      sent: results.filter((r) => r.ok).length,
      sent_last_24h: alreadySent + results.filter((r) => r.ok).length,
      daily_cap: dailyCap,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
