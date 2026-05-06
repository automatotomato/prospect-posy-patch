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
      hiringSignal ? `Hiring Signal: They appear to be hiring for phone/receptionist/VA roles` : null,
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
            content: `You are a cold call script writer for Automate Planet, a Las Vegas AI Communications Company. The product is a safety net that catches the calls a business is currently missing, captures the lead, re-engages immediately, and books the next step so the lead doesn't go shop a competitor.

THE ONLY GOAL OF THIS CALL IS TO BOOK A 15-MINUTE APPOINTMENT. Do NOT try to close the deal on the cold call. Move from curiosity → pain → value → appointment.

Required structure (use these exact section headers, in this order):

OPENING (Pattern Interrupt)
- "Hey, is this {{contact_name}}?"
- "Hey {{contact_name}}, this is [Your Name]. You want the good news or the bad news?"
- (pause)

PAIN
- "So I called your business and couldn't get anyone on the phone. And honestly, that's not even the bad news."
- "The bad news is if that happens consistently, even just a few missed calls a day can turn into a serious amount of lost revenue every month."
- Personalize lightly to the business name / industry / location.

QUANTIFY
- "Three missed calls a day is around 90 a month. If even a fraction of those become customers, that's real money left on the table."

REFRAME (if they say they're busy or not trying to grow)
- "Totally fair. This isn't about more volume. It's about not losing the best-fit opportunities and giving you more control over which jobs you take, which customers you work with, and what you can charge."

OFFER
- "What we do is help businesses stop losing those missed opportunities by putting a system in place that catches the calls they're not answering. It doesn't replace what's already working — it acts as a safety net for the calls that would otherwise go to voicemail or disappear."
- "So instead of that lead going cold or calling the next company, they get responded to right away, their info gets captured, and they get moved toward the next step."

OBJECTION HANDLERS (include all three, worded like this)
- "We already have someone handling calls" → "Understood. This wouldn't replace them. It just makes sure the opportunities they miss don't get lost. Not necessarily that they're not doing their job — clearly some opportunities are still slipping through."
- "We're already busy" → "I get that. This is less about adding random volume and more about helping you capture the right opportunities instead of letting them slip away."
- "I don't want AI hurting the customer experience" → "Makes sense. First impressions matter. That's exactly why this works best as a backup for the calls you're already missing anyway. No answer at all is already a bad experience — this gives you a way to re-engage that lead immediately."

IF THEY ASK HOW IT WORKS
- "Great question. The easiest way to explain it: it captures the lead, re-engages them right away, and helps get them booked for the next step so they don't go shopping around while they wait."

BOOKING (Hard Close)
- "Honestly, the easiest thing would be for me to show you exactly how this would look for your business. It only takes about 15 minutes."
- "Would tomorrow morning or tomorrow afternoon be better for you?"
- Then: "Perfect. I have [Option A] or [Option B] — which works better?"

CONFIRM & WRAP
- "Perfect, I have you down for [Day] at [Time]. What's the best email for the invite?"
- "And is this the best number for a confirmation text?"
- "Awesome — I'll send that over right now. Looking forward to it."

NON-NEGOTIABLE RULES:
- Conversational, not memorized or robotic. Sell the problem before explaining the product.
- NEVER insult current staff. Use "Not necessarily, but clearly some opportunities are still slipping through."
- NEVER use vague closes like "Want to see it sometime?" — always offer two specific time options.
- Don't over-explain AI, workflows, or integrations.
- Don't argue objections — agree first, then redirect to the business outcome.
- Don't try to close the whole deal on this call. The win is the appointment.
- If a hiring signal is provided (they're hiring for phone/receptionist/VA roles), weave into OPENING/PAIN: "I saw you're looking for someone to help with your phones — this works as a backup either way."
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
