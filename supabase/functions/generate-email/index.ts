import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from 'https://esm.sh/openai@4.20.1';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
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

    const { businessData, emailType } = await req.json();

    if (!businessData) {
      return new Response(
        JSON.stringify({ error: 'Business data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    console.log('Generating email for:', businessData.businessName);

    const emailTypePrompts: Record<string, string> = {
      introduction: 'Write a personalized cold outreach email tailored to THIS specific business. Lead with one sharp observation about their industry or situation. Offer a risk-free demo on a real phone number we set up for them so they can hear the AI in action before committing. Soft CTA: invite them to call or text Alex directly at (702) 863-3200 or book a quick time at https://calendly.com/automateplanet/15.',
      followup: 'Write a short personalized follow-up. Do NOT say "just following up" or "circling back". Open with a fresh angle on a pain point. End by offering a risk-free live demo on their own number, and ask them to call or text Alex at (702) 863-3200 or book a time at https://calendly.com/automateplanet/15 to set it up.',
      quote: 'Write a brief personalized email about helping their type of business. Offer a risk-free demo on a dedicated number so they can hear how it would handle their calls. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15.',
      renewal: 'Write a warm, personalized check-in email. Offer a fresh risk-free demo to see what is new. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15.',
      metinperson: 'Write a warm follow-up for someone I just met in person. Reference our conversation. Offer to set up a risk-free live demo on a real number for their business so they can hear it work. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15.',
      postcall: 'Write a warm post-call follow-up email. Thank them for the conversation. Reinforce one thing they cared about. Offer a risk-free live demo on a dedicated phone number so they can experience how the AI handles their calls before committing. CTA: call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15.',
      proposal: `Write a personalized post-call PROPOSAL email for a prospect who showed real interest during our phone conversation. This is a tailored summary + soft proposal, not a generic follow-up.

STRUCTURE (keep it scannable, this email can be slightly longer than usual — 120-180 words before signature):
1. Warm one-line opener thanking them for the call (reference something specific they mentioned in the notes if available).
2. Short paragraph: "Here is a quick recap of what we'd set up for {{businessName}}" — then a tailored 3-4 bullet summary of the services that fit THEIR business based on the notes/services/industry. Bullets should describe outcomes (e.g. "24/7 AI receptionist that books jobs straight into your calendar"), not features. Tie each bullet to something they actually care about.
3. One sentence on pricing posture: no commitment, risk-free demo on a real number tied to their business first, 500 free calls if they want to keep going, walk away if it is not a fit.
4. Clear ASK: "What's a good day and time this week for a full demo and onboarding walkthrough? I can do mornings or afternoons, your call."
5. Mention they can also call or text Alex directly at (702) 863-3200 or book directly at https://calendly.com/automateplanet/15 if that's easier.

TONE: Confident, founder-to-founder, like a real proposal you'd send after a good call. NOT a templated drip. Bullets ARE allowed in this email type (override the no-bullets rule) since it is a proposal recap.`,
      towing: `Write a personalized cold outreach email specifically for a TOWING company. The core promise: we will help them DOUBLE their bookings while saving time and money.

KEY POINTS TO WEAVE IN:
- We built a custom AI dispatcher purpose-built for towing companies: https://towingapp.automateplanet.com
- Every missed call at 2am is a tow job that went to a competitor
- Our AI answers in under 1 second, 24/7, captures location/vehicle/situation, dispatches the right truck, and books the job
- Doubles bookings by catching every after-hours, busy-line, and overflow call they currently miss
- Saves money vs hiring a 24/7 dispatcher or answering service
- Saves time because drivers get clean, structured job tickets instead of scrambled phone notes

PRIMARY CTA: Call or text Alex at (702) 863-3200 or book at https://calendly.com/automateplanet/15 to set up a risk-free live demo on a real number for their towing company. Mention they can also see it at https://towingapp.automateplanet.com.

Make it sound like one operator talking to another. Reference towing realities (after-hours calls, accident scenes, motor clubs, impounds) when relevant.`,
      campaign_500_free: `Write a personalized campaign email offering a risk-free demo PLUS 500 free calls, no credit card, no commitment.

KEY OFFER:
- Risk-free live demo on a real phone number set up for THEIR business so they can call it and hear it work
- 500 calls completely free if they want to keep going, no credit card, no commitment
- If it is not a fit, they walk away

PRIMARY CTA: Tell them to call or text Alex directly at (702) 863-3200 or book a time at https://calendly.com/automateplanet/15 to get the demo line set up.

FEATURES TO WEAVE IN NATURALLY (pick 2 max, the most relevant ones):
- Answers every call 24/7 in under 1 second
- Speaks 72+ languages
- Books appointments and captures leads during live calls
- Transfers to a real person when asked

Make it feel like a personal invitation from one business owner to another, not a mass blast.`,
    };

    const typePrompt = emailTypePrompts[emailType] || emailTypePrompts.introduction;

    // Build context
    const contextParts: string[] = [];
    if (businessData.businessName) contextParts.push(`Business: ${businessData.businessName}`);
    if (businessData.contactName) contextParts.push(`Contact: ${businessData.contactName}`);
    if (businessData.address || businessData.location) contextParts.push(`Location: ${businessData.address || businessData.location}`);
    if (businessData.services) contextParts.push(`Services: ${businessData.services}`);
    if (businessData.notes) contextParts.push(`Notes: ${businessData.notes}`);

    // Detect industry and business category
    const businessText = `${businessData.businessName || ''} ${businessData.services || ''} ${businessData.notes || ''}`.toLowerCase();
    
    let bizCategory = "service_business";
    if (businessText.match(/tow|wrecker|roadside|recovery|impound/)) bizCategory = "towing";
    else if (businessText.match(/crm|hubspot|salesforce|zoho|pipedrive/)) bizCategory = "saas_crm";
    else if (businessText.match(/quickbooks|xero|freshbooks|accounting software|payroll/)) bizCategory = "saas_accounting";
    else if (businessText.match(/voip|telecom|phone system|ringcentral|dialpad/)) bizCategory = "saas_phone";
    else if (businessText.match(/utility|electric.*company|gas.*company|water.*company|internet provider/)) bizCategory = "utility";
    else if (businessText.match(/city hall|county|water district|public works|housing authority|transit|school district|government|municipal/)) bizCategory = "government";
    else if (businessText.match(/marketing.*agenc|digital.*agenc/)) bizCategory = "agency";

    // Force towing category when emailType is towing
    if (emailType === 'towing') bizCategory = 'towing';

    // Detect contact role from notes
    const contactRole = (businessData.notes || '').match(/Contact role:\s*([^\n.]+)/i)?.[1]?.toLowerCase() || '';
    let contactType = "general";
    if (contactRole.match(/owner|founder|ceo|president/)) contactType = "owner";
    else if (contactRole.match(/partner|bd|bizdev|alliance/)) contactType = "partnerships";
    else if (contactRole.match(/hr|human resource|people|talent/)) contactType = "hr";
    else if (contactRole.match(/ir|investor|cfo/)) contactType = "investor_relations";
    else if (contactRole.match(/coo|vp|director|manager/)) contactType = "decision_maker";
    else if (contactRole.match(/city manager|administrator|clerk|commissioner/)) contactType = "government_official";

    // Dynamic value prop
    const getValueProp = () => {
      if (bizCategory === "towing") return "Every call you miss after hours, on another tow, or during a busy stretch is a job that just went to the next towing company on Google. We built an AI dispatcher purpose-built for towing (https://towingapp.automateplanet.com) that answers in under a second 24/7, captures location, vehicle, and situation, and dispatches the right truck. Operators are doubling their bookings while spending less than they would on a 24/7 dispatcher.";
      if (bizCategory === "saas_crm") return "Your customers' teams lose business every time a call goes to voicemail. We built AI phone agents that pick up, book appointments, and log everything. It's a cost-effective alternative to a VA, and a native CRM integration could be a real differentiator for your platform.";
      if (bizCategory === "saas_accounting") return "Service businesses using your platform are losing jobs every time a call goes unanswered. Our AI picks up, books the job, and captures the details at a fraction of the cost of a VA. The call data would pair naturally with invoicing and job tracking.";
      if (bizCategory === "saas_phone") return "When your customers' lines are busy or closed, those callers move on to a competitor. Our AI handles overflow and after-hours as a cost-effective layer on top of your phone system. A partnership could offer your users instant AI backup.";
      if (bizCategory === "utility") return "During outages and billing cycles, call volume spikes and hold times climb. Our AI handles routine inquiries instantly at a fraction of the cost of expanding your call center, so your staff can focus on the complex issues.";
      if (bizCategory === "government") return "When residents can't get through, they lose trust. Our AI handles routine calls 24/7 at a fraction of the cost of adding call center support, so your staff can focus on what matters most.";
      if (bizCategory === "agency") return "Your clients lose customers every time a call goes to voicemail. We built AI that picks up, books appointments, and sends quotes to callers in real-time. It's a cost-effective solution you could offer as a referral or white-label.";
      return "When your phones are busy or nobody picks up, that customer calls the next business on Google. We're a cost-effective alternative to hiring a VA or call center. Our AI picks up every call, books appointments, and transfers to your team when someone asks for a person.";
    };

    const getCTA = () => {
      if (contactType === "owner") return "Open to a quick risk-free demo on a real number we set up for your business so you can hear it handle your calls? Call or text me at (702) 863-3200 or book a time here: https://calendly.com/automateplanet/15.";
      if (contactType === "partnerships") return "Worth a quick call to see if there is a partnership fit? My cell is (702) 863-3200, or grab a time here: https://calendly.com/automateplanet/15.";
      if (contactType === "investor_relations") return "Happy to share more about what we are building. Call or text me at (702) 863-3200 or book a time: https://calendly.com/automateplanet/15.";
      if (contactType === "hr") return "Could you point me to whoever runs operations or phones? Or just have them call or text me at (702) 863-3200 or book here: https://calendly.com/automateplanet/15.";
      if (contactType === "government_official") return "Open to a risk-free demo on a real number for your department? Call or text me at (702) 863-3200 or book a time: https://calendly.com/automateplanet/15.";
      return "If this sounds worth exploring, call or text me at (702) 863-3200 or book a time at https://calendly.com/automateplanet/15 and I will set up a risk-free live demo on a real number for your business.";
    };

    const contactName = businessData.contactName;
    const greeting = contactName ? `Hi ${contactName.split(' ')[0]},` : `Hi ${businessData.businessName || 'there'} team,`;

    const isProposal = emailType === 'proposal';

    const systemPrompt = `You are Alex Perez, founder of Automate Planet (Las Vegas AI communications company). You write ${isProposal ? 'tailored post-call proposals' : 'cold emails'} the way a real founder writes them: ${isProposal ? 'specific, organized, and human' : 'short, specific, and human'}. Every email must be UNIQUELY tailored to THIS recipient.${isProposal ? `

PROPOSAL MODE OVERRIDES (this is a post-call proposal email, not a cold email):
- Length: 120-180 words before the signature is fine
- Bullets ARE allowed (3-4 outcome-focused bullets recapping what we'd set up for them)
- The CTA is to ask for a specific day/time for a full demo and onboarding walkthrough this week
- Mention they can also call/text (702) 863-3200 or use https://calendly.com/automateplanet/15 if easier
- Subject line: reference "proposal" or "next steps" — sentence case, no hype words
- The P.S. should be a short personal line, not the standard cold-email demo offer
` : ''}

THE EMAIL MUST:
- Open with: "${greeting}"
- Include this value prop tailored to their situation: "${getValueProp()}"
- End the body with this CTA: "${getCTA()}"
- Close with the signature: "Alex Perez\\nAutomate Planet | (702) 863-3200"
- After the signature, add a P.S. line offering a risk-free live demo on a dedicated phone number for their business. Wording should vary each time, but always communicate: no credit card, no commitment, walk away if it is not a fit, and to call or text Alex at (702) 863-3200 or book a time at https://calendly.com/automateplanet/15 to set it up.

POSITIONING RULES:
- Position the AI as backup so their team handles what matters, NEVER as a replacement for staff
- Frame missed calls as customers calling the next business on Google
- When a caller asks for a human, the AI transfers to a real person on their team
- Risk-free demo means: we set up a live phone number tied to THEIR business, they call it, hear it work, and decide
- Never ask for a "5-minute call", "quick chat", or push to a calendar link

WRITING RULES (cold email best practices):
- 50-80 words before the signature. Shorter wins.
- Write like one business owner texting another. Conversational, confident, never desperate.
- Reference something specific about their business, industry, or role in the first sentence
- ONE clear CTA only: call or text (702) 863-3200 or book a time at https://calendly.com/automateplanet/15
- The P.S. line carries the demo offer (P.S. is the second-most-read line in any email)
- NO em dashes. Use commas or periods.
- NO "I hope this finds you well", "I noticed", "I came across", "Just following up", "Touching base", "Circling back"
- NO jargon: "leverage", "optimize", "streamline", "synergy", "cutting-edge"
- NO bullet points or lists in the body
- NO links in the body. The phone number is the only CTA.
- Subject line: 3-5 words, lowercase or sentence case (NOT Title Case), curiosity-led, NEVER include the words "demo", "AI", "free", or the recipient business name verbatim — those trigger spam filters and feel salesy
- If the email could be sent to anyone else, REWRITE it.

Return JSON: {"subject": "...", "body": "...", "preview": "first 50 chars"}`;

    const userPrompt = `${typePrompt}

Prospect details:
${contextParts.join('\n')}
Business Category: ${bizCategory}
Contact Type: ${contactType}

This is a ${bizCategory === "service_business" ? "service business we want as a client" : bizCategory.startsWith("saas") ? "SaaS company we want as an integration partner" : bizCategory === "government" ? "government agency" : bizCategory === "utility" ? "utility company" : bizCategory === "agency" ? "agency we want as a referral partner" : "business"}.

Write an email that feels like it was written ONLY for ${contactName || businessData.businessName}. Return valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
    });

    const content = response.choices?.[0]?.message?.content;

    console.log('Email generated');

    // Parse the JSON from the response
    let emailData;
    try {
      let jsonString = content || '';
      if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      emailData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      emailData = {
        subject: `AI Employees for ${businessData.businessName || 'Your Business'}`,
        body: content,
        preview: 'Never miss a call or lead again.'
      };
    }

    return new Response(
      JSON.stringify({ success: true, data: emailData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in generate-email function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
