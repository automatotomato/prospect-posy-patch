import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

type Msg = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM = `You are a segmentation assistant for Z&C Consultants' outreach platform.
The user has a list of contacts (their "clients") with these fields:
- business_name, contact_name, email, phone, industry, location, tags (array), client_type (one of: current, previous, prospect), do_not_contact, unsubscribed.

Your job: help the user describe a SEGMENT of contacts to target with a campaign. Ask clarifying questions when needed (e.g. is this for re-engagement of previous customers, upsell to current, or new prospects?). When you are confident about the segment, propose a filter and include a JSON block at the end of your reply formatted EXACTLY as:

\`\`\`segment
{
  "name": "Short segment name",
  "description": "One sentence describing the audience",
  "filter": {
    "client_type": ["current"|"previous"|"prospect"] | null,
    "industries": [string] | null,
    "tags_any": [string] | null,
    "location_includes": string | null,
    "search": string | null,
    "require_email": true|false,
    "exclude_dnc": true|false,
    "exclude_unsubscribed": true|false
  }
}
\`\`\`

Only include the \`\`\`segment block when you are proposing a concrete filter to apply. Be concise, friendly, and reference the available industries/tags the user has when helpful.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages = [], context = {} } = await req.json() as { messages: Msg[]; context: any };

    const ctxText = `Inventory summary:
- Total contacts: ${context.total ?? 0}
- By type: ${JSON.stringify(context.byType ?? {})}
- Industries (top): ${(context.industries ?? []).slice(0, 25).join(", ") || "—"}
- Tags (top): ${(context.tags ?? []).slice(0, 25).join(", ") || "—"}
- Locations (sample): ${(context.locations ?? []).slice(0, 15).join(", ") || "—"}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "system", content: ctxText },
          ...messages,
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: "OpenAI error", detail: errText }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // Extract optional segment JSON block
    let segment: any = null;
    const m = content.match(/```segment\s*([\s\S]*?)```/i);
    if (m) {
      try { segment = JSON.parse(m[1].trim()); } catch (_) { /* ignore */ }
    }
    const reply = content.replace(/```segment[\s\S]*?```/i, "").trim();

    return new Response(JSON.stringify({ reply, segment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
