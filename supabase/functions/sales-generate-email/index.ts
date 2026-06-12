import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ZC_PROFILE } from "../_shared/zc-profile.ts";

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

    const systemPrompt = `You are an SDR for Z & C Consultants. Use ONLY the company profile below as ground truth — never invent capabilities outside it.\n\n${ZC_PROFILE}`;

    const userPrompt = `Write a personalized outreach email for this business:

Business: ${lead.business_name}
Industry: ${lead.industry || "unknown"}
City: ${lead.city || "unknown"}, ${lead.state || ""}
Website: ${lead.website || "n/a"}
${lead.notes ? `Context notes: ${lead.notes}` : ""}

Pick the ONE Z&C capability most relevant to this vertical (e.g. Power BI dashboards, MRP/BOM, RPA, forecasting, RAG knowledge agent, ERP integration) and tie it to a believable spreadsheet/manual-reporting pain they likely face.

Return strict JSON only:
{"subject": "...", "body": "..."}

- Subject < 55 chars, casual, no clickbait.
- Body < 110 words, plain text, opens with something specific (city / niche / name), not "I hope this finds you well".
- End with a single open question.
- Do NOT include a calendar/booking URL in the body — the send pipeline appends a "Book a 15-min call" button automatically. You may mention "grab a slot on my calendar below" or "reply, call, or pick a time" but never paste a URL.
- Sign off exactly:\n— Z & C Consultants\n+1 (214) 997-4331`;

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
