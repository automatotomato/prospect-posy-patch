import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from 'https://esm.sh/openai@4.20.1';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND } from "../_shared/brand.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
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
      return new Response(JSON.stringify({ error: 'Business data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const emailTypePrompts: Record<string, string> = {
      introduction: `Write a personalized cold outreach email tailored to THIS specific business. Lead with one sharp observation about their operation (manufacturing/warehouse/logistics/transport/inventory pain). Offer to compare notes about where spreadsheets and manual reporting are slowing their team down. Soft CTA: reply or call/text ${BRAND.phone}.`,
      followup: `Write a short personalized follow-up. Do NOT say "just following up" or "circling back". Open with a fresh angle on a reporting or spreadsheet pain. Offer to share what we've built for a similar operations team. CTA: reply or call/text ${BRAND.phone}.`,
      quote: `Write a brief personalized email about helping their type of operation get out of fragile spreadsheets and into clean dashboards / small automations. CTA: reply or call/text ${BRAND.phone}.`,
      renewal: `Write a warm, personalized check-in email. Offer a fresh look at what we've shipped recently for similar operations teams. CTA: reply or call/text ${BRAND.phone}.`,
      metinperson: `Write a warm follow-up for someone we just met in person. Reference our conversation. Offer to send over a quick before/after of a similar dashboard or automation. CTA: reply or call/text ${BRAND.phone}.`,
      postcall: `Write a warm post-call follow-up email. Thank them for the conversation. Reinforce one thing they cared about. Offer a tailored next step (scoping a small POC, sharing a sample Power BI rollup, mapping their current workflow). CTA: reply or call/text ${BRAND.phone}.`,
      proposal: `Write a personalized post-call PROPOSAL email for a prospect who showed real interest during our conversation. Tailored summary + soft proposal, not generic follow-up.

STRUCTURE (120-180 words, scannable):
1. Warm one-line opener thanking them for the call (reference something specific they mentioned if available).
2. Short paragraph: "Here is what we'd set up for {{businessName}}" — then 3-4 bullets describing outcomes (e.g. "single Power BI dashboard rolling up production + inventory + on-time delivery", "automated daily ops report emailed at 6am", "small custom tool replacing the 14-tab planning spreadsheet").
3. One sentence on engagement posture: lightweight scoping first, fixed-scope pilot, no long contract.
4. Clear ASK: "What's a good day and time this week for a 30-min scoping walkthrough?"
5. Mention they can also reply or call/text ${BRAND.phone}.

TONE: founder-to-operator, confident, like a real proposal. Bullets ARE allowed in this email type only.`,
    };

    const typePrompt = emailTypePrompts[emailType] || emailTypePrompts.introduction;

    const contextParts: string[] = [];
    if (businessData.businessName) contextParts.push(`Business: ${businessData.businessName}`);
    if (businessData.contactName) contextParts.push(`Contact: ${businessData.contactName}`);
    if (businessData.address || businessData.location) contextParts.push(`Location: ${businessData.address || businessData.location}`);
    if (businessData.services) contextParts.push(`Services: ${businessData.services}`);
    if (businessData.notes) contextParts.push(`Notes: ${businessData.notes}`);

    const businessText = `${businessData.businessName || ''} ${businessData.services || ''} ${businessData.notes || ''}`.toLowerCase();
    let bizCategory = "operations";
    if (businessText.match(/manufactur|fabricat|machin|production/)) bizCategory = "manufacturing";
    else if (businessText.match(/warehouse|distribution|3pl|fulfill/)) bizCategory = "warehousing";
    else if (businessText.match(/logistic|freight|trucking|transport|carrier|dispatch/)) bizCategory = "logistics";
    else if (businessText.match(/wholesale|supply|distrib/)) bizCategory = "wholesale";
    else if (businessText.match(/inventory|stock|asset/)) bizCategory = "inventory";

    const getValueProp = () => {
      if (bizCategory === "manufacturing") return "Most manufacturers we talk to are still running production reporting, scrap tracking, and on-time delivery off a stack of spreadsheets that one person owns. We replace that with a single Power BI dashboard and a couple of small automations so the data updates itself and leadership stops waiting until Monday to see Friday's numbers.";
      if (bizCategory === "warehousing") return "Most warehouses we talk to are tracking inbound, putaway, picks, and labor across three or four spreadsheets that don't agree with each other. We build a single operations dashboard that pulls from your WMS/ERP and a few targeted automations so your ops manager isn't rebuilding the same report every morning.";
      if (bizCategory === "logistics") return "Most carriers and 3PLs we talk to are still rebuilding the same load/route/margin report by hand every week. We pull it into a Power BI dashboard with a daily refresh and automate the pieces that don't need a human — so dispatch and ops spend their time on exceptions, not data entry.";
      if (bizCategory === "wholesale") return "Most distributors we talk to are running sales, inventory turns, and backorder analysis off siloed spreadsheets. We unify it into one rollup and automate the daily/weekly reports so leadership sees the real picture, not the version someone hand-fixed at 11pm.";
      if (bizCategory === "inventory") return "Most inventory-heavy teams we talk to are reconciling counts, par levels, and reorders across spreadsheets that drift every week. We build the dashboard + the small automations that keep the data honest and the reorders timely without adding headcount.";
      return "Most operations teams we talk to are running their business off spreadsheets that one person owns and that break every time something changes. We replace that with proper dashboards, small automations, and lightweight custom tools — so the data updates itself and leadership stops waiting for reports.";
    };

    const cta = `If this resonates, reply to this email or call/text me at ${BRAND.phone} and we can compare notes for 10 minutes — no pitch.`;

    const contactName = businessData.contactName;
    const greeting = contactName ? `Hi ${contactName.split(' ')[0]},` : `Hi ${businessData.businessName || 'there'} team,`;

    const isProposal = emailType === 'proposal';

    const systemPrompt = `You write on behalf of ${BRAND.companyName}. ${BRAND.whatWeDo}

You write ${isProposal ? 'tailored post-call proposals' : 'cold emails'} the way a real consultant writes them: ${isProposal ? 'specific, organized, and human' : 'short, specific, and human'}. Every email must be UNIQUELY tailored to THIS recipient.${isProposal ? `

PROPOSAL MODE (override standard cold-email rules):
- Length: 120-180 words before the signature is fine
- Bullets ARE allowed (3-4 outcome-focused bullets)
- The CTA is to ask for a specific day/time for a 30-min scoping walkthrough this week
- Subject line: reference "proposal" or "next steps" — sentence case, no hype
` : ''}

THE EMAIL MUST:
- Open with: "${greeting}"
- Include this value prop tailored to their situation: "${getValueProp()}"
- End the body with this CTA: "${cta}"
- Close with the signature exactly: "${BRAND.signature.replace(/\n/g, "\\n")}"

POSITIONING RULES:
- We replace fragile spreadsheets and manual reporting — not people
- Concrete examples we name: Power BI dashboards, automated daily reports, small custom tools, system-to-system integrations, scrap/yield/on-time-delivery rollups
- Never push hard. The ask is a 10-min conversation, not a demo.

WRITING RULES (cold email best practices):
- 50-80 words before the signature. Shorter wins.
- Write like one operator texting another. Conversational, confident, never desperate.
- Reference something specific about their business, industry, or operation in the first sentence
- ONE clear CTA only: reply or call/text ${BRAND.phone}
- NO em dashes. Use commas or periods.
- NO "I hope this finds you well", "I noticed", "I came across", "Just following up", "Touching base", "Circling back"
- NO jargon: "leverage", "optimize", "streamline", "synergy", "cutting-edge", "best-in-class"
- NO bullet points or lists in the body (except in PROPOSAL mode)
- NO links anywhere
- Subject line: 3-6 words, sentence case, curiosity-led, NEVER include "demo", "AI", "free", or the recipient business name verbatim
- If the email could be sent to anyone else, REWRITE it.

Return JSON: {"subject": "...", "body": "...", "preview": "first 50 chars"}`;

    const userPrompt = `${typePrompt}

Prospect details:
${contextParts.join('\n')}
Business Category: ${bizCategory}

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
        subject: `Quick note for ${businessData.businessName || 'your ops team'}`,
        body: content,
        preview: (content || '').slice(0, 50),
      };
    }

    return new Response(JSON.stringify(emailData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
