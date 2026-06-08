import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { businessName, contactName, industry, location, phone, notes, website, hiringSignal } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const contextParts = [
      `Business: ${businessName}`,
      contactName ? `Contact: ${contactName}` : null,
      industry ? `Industry: ${industry}` : null,
      location ? `Location: ${location}` : null,
      notes ? `Notes: ${notes}` : null,
      website ? `Website: ${website}` : null,
      hiringSignal ? `Hiring Signal: They appear to be hiring for data/analyst/operations roles` : null,
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a cold call script writer for Z & C Consultants, a consulting firm specializing in business intelligence, data analytics, Power BI development, process automation, and custom software for operations-heavy teams (manufacturing, warehousing, logistics, transport, inventory).

THE ONLY GOAL OF THIS CALL IS TO BOOK A 15-MINUTE SCOPING CALL. Do NOT try to close the deal on the cold call. Move from curiosity → pain → value → appointment.

Required structure (use these exact section headers, in this order):

OPENING (Pattern Interrupt)
- "Hey, is this {{contact_name}}?"
- "Hey {{contact_name}}, this is [Your Name] from Z & C Consultants. You want the good news or the bad news?"
- (pause)

PAIN
- "The bad news is most operations teams in {{industry}} are still running their business off spreadsheets that one person owns and that break every time something changes."
- "The good news is it doesn't have to stay that way."
- Personalize lightly to the business name / industry / location.

QUANTIFY
- "If your ops manager spends even 5 hours a week rebuilding the same report, that's 250+ hours a year — basically a full month of work — on data assembly instead of running the business."

REFRAME (if they say they're busy or not trying to grow)
- "Totally fair. This isn't about adding headcount. It's about stopping the hidden tax of manual reporting so your team can focus on exceptions, not data entry."

OFFER
- "What we do is build live dashboards and small automations that pull from your existing systems — WMS, ERP, SQL, whatever you're already using — so your reports update themselves every morning instead of someone rebuilding them by hand."
- "No replatforming, no new software for your team to learn. Just clean data that runs itself."

OBJECTION HANDLERS (include all three, worded like this)
- "We already have an IT person / someone handles reports" → "Understood. This wouldn't replace them. It just removes the repetitive data-pull work so they can focus on the harder problems."
- "We're fine with Excel / our current setup works" → "I get that. Most teams are fine with Excel... until the one person who built the model is out sick, or the formula breaks, or leadership asks a question the spreadsheet can't answer. We make it bulletproof."
- "I don't think we need dashboards" → "Fair. A lot of owners feel that way until they see their real numbers in one place for the first time — inventory, throughput, on-time delivery, margin — without waiting for someone to compile it."

IF THEY ASK HOW IT WORKS
- "Great question. The easiest way to explain it: we wire up your existing data sources into a live dashboard and automate the reports your team is currently building by hand. Typically a 2-3 week pilot on one dashboard so you can see the value before anything bigger."

BOOKING (Hard Close)
- "Honestly, the easiest thing would be for me to walk you through what this would look like for your business. It only takes about 15 minutes."
- "Would tomorrow morning or tomorrow afternoon be better for you?"
- Then: "Perfect. I have [Option A] or [Option B] — which works better?"

CONFIRM & WRAP
- "Perfect, I have you down for [Day] at [Time]. What's the best email for the invite?"
- "And is this the best number for a confirmation text?"
- "Awesome — I'll send that over right now. Looking forward to it."

NON-NEGOTIABLE RULES:
- Conversational, not memorized or robotic. Sell the problem before explaining the product.
- NEVER insult current staff. Use language that makes their team look smart and their current tools look tired.
- NEVER use vague closes like "Want to see it sometime?" — always offer two specific time options.
- Don't over-explain Power BI, SQL, or technical integrations.
- Don't argue objections — agree first, then redirect to the business outcome.
- Don't try to close the whole deal on this call. The win is the appointment.
- If a hiring signal is provided (they're hiring for data/analyst/operations roles), weave into OPENING/PAIN: "I saw you're looking for someone to help with reporting — this works as a complement either way."
- Use {{contact_name}} as a placeholder if no contact name is provided.
- Target length: 250–350 words total.`
          },
          {
            role: "user",
            content: `Generate the cold call script for this prospect, following the structure exactly:\n\n${contextParts}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const script = data.choices?.[0]?.message?.content || "Could not generate script.";

    return new Response(JSON.stringify({ script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-call-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
