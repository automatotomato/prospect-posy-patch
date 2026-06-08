import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);
    const { data: lead, error: leadErr } = await admin.from("sales_leads").select("*").eq("id", lead_id).single();
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (lead.owner_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an SDR for Z-C Consultants, helping spreadsheet-heavy operations (manufacturing, warehousing, logistics, transportation, inventory, distribution) replace messy Excel work with simple automation. Write SHORT, warm, human cold outreach emails that focus on building a connection — NOT pitching. Reference something specific about the prospect's business. End with a soft, low-friction question (no hard CTA, no demo ask, no calendar link). Maximum 90 words. No emojis. No marketing fluff. Tone: curious peer, not salesperson.`;

    const userPrompt = `Write an outreach email for this business:

Business: ${lead.business_name}
Industry: ${lead.industry || "unknown"}
City: ${lead.city || "unknown"}, ${lead.state || ""}
Website: ${lead.website || "n/a"}

Return strict JSON only:
{"subject": "...", "body": "..."}

Rules:
- Subject under 50 chars, casual, no clickbait.
- Body opens with their name/something specific, NOT "I hope this finds you well".
- Mention spreadsheets/manual data work briefly as a curiosity hook, not a pitch.
- Sign off simply: "— Z-C Consultants".
- End with a single open question (e.g., "Curious — how are you handling X today?").`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", status: aiRes.status, details: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: { subject?: string; body?: string };
    try { parsed = JSON.parse(content); } catch { parsed = { subject: "Quick question", body: content }; }

    const { data: updated, error: updErr } = await admin.from("sales_leads").update({
      email_subject: parsed.subject || "Quick question",
      email_body: parsed.body || "",
      email_generated_at: new Date().toISOString(),
      status: lead.status === "new" ? "drafted" : lead.status,
    }).eq("id", lead_id).select().single();

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ lead: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
