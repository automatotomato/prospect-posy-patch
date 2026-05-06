import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
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

    if (!briefDescription) {
      throw new Error("Brief description is required");
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Detect business category from description/name
    const descText = `${briefDescription} ${businessName || ''}`.toLowerCase();
    let bizCategory = "service_business";
    if (descText.match(/crm|hubspot|salesforce|zoho/)) bizCategory = "saas_crm";
    else if (descText.match(/quickbooks|xero|accounting|payroll/)) bizCategory = "saas_accounting";
    else if (descText.match(/voip|telecom|phone system/)) bizCategory = "saas_phone";
    else if (descText.match(/utility|electric|gas|water/)) bizCategory = "utility";
    else if (descText.match(/city hall|county|government|municipal|public works/)) bizCategory = "government";
    else if (descText.match(/agency|marketing agency/)) bizCategory = "agency";

    // Check email type from description
    const isPostCall = (briefDescription || '').toLowerCase().includes('post call') || (briefDescription || '').toLowerCase().includes('postcall');
    const isCampaign500 = (briefDescription || '').toLowerCase().includes('500 free') || (briefDescription || '').toLowerCase().includes('campaign') || (briefDescription || '').toLowerCase().includes('risk free');

    const purposeContext = isCampaign500
? "This is a campaign email offering a RISK-FREE LIVE DEMO plus 500 free calls. Frame it as: we set up a real phone number tied to their business so they can call it and hear the AI work. If they want to keep going, they get 500 free calls, no credit card, no commitment, walk away if it's not a fit. PRIMARY CTA: tell them to call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15 to get the demo line set up. Personal invitation, not a mass blast."
      : isPostCall
      ? "This is a post-call follow-up. Thank them, reinforce one thing they cared about. Offer a risk-free live demo on a dedicated phone number set up for their business so they can hear how the AI handles their calls. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15."
      : bizCategory === "service_business"
      ? "This is a service business we want as a client. When their phones are busy or go to voicemail, those customers call the next business on Google. Position AI as backup so their team focuses on the work. Offer a risk-free live demo on a real number for their business and ask them to call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15."
      : bizCategory.startsWith("saas")
      ? "This is a SaaS company we want as an integration partner. Their customers lose business when calls go unanswered. Our AI is the layer that picks up, books appointments, and logs the data. Offer a quick call about a partnership. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15."
      : bizCategory === "government"
      ? "This is a government agency. When residents can't get through, trust erodes. Our AI handles routine calls 24/7 so staff focuses on what needs a human. Offer a risk-free live demo on a real number for their department. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15."
      : bizCategory === "utility"
      ? "This is a utility company. During outages and billing cycles, call volume crushes their team. Our AI handles routine inquiries instantly. Offer a risk-free live demo on a real number for their team. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15."
      : bizCategory === "agency"
      ? "This is a marketing agency. Their clients lose customers to missed calls. Pitch a referral or white-label fit. Offer a risk-free live demo on a real number so they can hear it. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15."
      : "When calls go unanswered, customers move on to a competitor. Offer a risk-free live demo on a real number set up for their business. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15.";

    const systemPrompt = `You are Alex Perez, founder of Automate Planet (Las Vegas AI communications company). Every email is UNIQUELY tailored to THIS recipient.

POSITIONING:
- AI is BACKUP for their team, never a replacement
- When a caller asks for a person, AI transfers to a real human on their team
- Risk-free demo = a live phone number we set up tied to THEIR business so they can call it and hear the AI in action before committing
- No credit card, no commitment, walk away if it's not a fit

WRITING RULES (cold email best practices):
- 50-75 words before the signature. Shorter wins.
- One business owner texting another. Conversational, confident.
- Reference something specific about their business in the first sentence.
- ONE CTA only: call or text (702) 863-3200 or book a time at https://calendly.com/automateplanet/15.
- Close with the signature: "Alex Perez\\nAutomate Planet | (702) 863-3200"
- Add a P.S. line offering the risk-free live demo. Wording must vary, but always communicate: no credit card, no commitment, walk away if it's not a fit, and to call or text Alex at (702) 863-3200 or book a time at https://calendly.com/automateplanet/15 to set it up.
- NO em dashes. NO bullet points or lists.
- NO "I hope this finds you well", "I noticed", "I came across", "Just following up"
- NO jargon: "leverage", "optimize", "streamline", "synergy", "cutting-edge"
- Subject line: 3-5 words, sentence case, curiosity-led. Do NOT include "demo", "AI", "free", or the business name verbatim — those trigger spam filters.
- If it could be sent to anyone else, REWRITE it.

OUTPUT: JSON with "subject" and "body" fields.`;
    const userPrompt = `Write a personalized email based on this description: "${briefDescription}"
${businessName ? `\nRecipient business: ${businessName}` : ''}
${recipientEmail ? `\nRecipient email: ${recipientEmail}` : ''}

${purposeContext}

The email must feel like it was written ONLY for this business. Return valid JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
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

    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    let emailData;
    try {
      emailData = JSON.parse(content);
    } catch {
      // Fallback if JSON parsing fails
      emailData = {
        subject: "Quick note from Alex at Automate Planet",
        body: content,
      };
    }

    console.log("Generated email:", { subject: emailData.subject });

    return new Response(JSON.stringify(emailData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in quick-generate-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
