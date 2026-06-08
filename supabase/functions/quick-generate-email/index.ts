import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND } from "../_shared/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { briefDescription, recipientEmail, businessName } = await req.json();
    if (!briefDescription) throw new Error("Brief description is required");

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OpenAI API key not configured");

    const systemPrompt = `You are writing on behalf of ${BRAND.companyName}.

ABOUT US: ${BRAND.whatWeDo}

WHO WE TARGET: Operations-heavy companies — manufacturing, warehousing, logistics, transportation, distribution, wholesale, 3PL, inventory management — that are drowning in fragile spreadsheets, manual reporting, and disconnected systems.

POSITIONING:
- We don't replace people. We replace fragile spreadsheets and manual reporting with clean dashboards and small automations.
- Common wins we name: a single source-of-truth dashboard, automated daily/weekly reports, a Power BI rollup that used to take a person 6 hours, a tiny custom tool that replaces a 12-tab spreadsheet, an integration that stops double data-entry between two systems.

WRITING RULES (cold email best practices):
- 50-80 words before the signature. Shorter wins.
- One operator talking to another. Conversational, confident, never salesy.
- Open with one specific, concrete observation about their industry or operation — NOT "I noticed", "I came across", "I hope this finds you well".
- ONE soft CTA: ask if it's worth a 10-min conversation about their current reporting/spreadsheet pain. They can reply or call/text ${BRAND.phone}.
- Close with the signature exactly: "${BRAND.signature.replace(/\n/g, "\\n")}"
- NO em dashes. NO bullet points. NO links.
- NO jargon: "leverage", "optimize", "streamline", "synergy", "cutting-edge", "best-in-class".
- Subject line: 3-6 words, sentence case, curiosity-led. Never include the words "demo", "AI", "free", or the recipient business name verbatim.
- If the email could be sent to anyone else, REWRITE it.

OUTPUT: JSON with "subject" and "body" fields.`;

    const userPrompt = `Write a personalized email based on this description: "${briefDescription}"
${businessName ? `\nRecipient business: ${businessName}` : ''}
${recipientEmail ? `\nRecipient email: ${recipientEmail}` : ''}

The email must feel like it was written ONLY for this business. Return valid JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("No content returned from OpenAI");

    let emailData;
    try {
      emailData = JSON.parse(content);
    } catch {
      emailData = { subject: `Quick note from ${BRAND.shortName}`, body: content };
    }

    return new Response(JSON.stringify(emailData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in quick-generate-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
