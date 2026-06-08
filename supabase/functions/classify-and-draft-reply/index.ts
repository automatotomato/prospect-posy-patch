import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You write on behalf of Z & C Consultants — a consulting firm specializing in business intelligence, data analytics, Power BI development, process automation, and custom software for operations-heavy teams (manufacturing, warehousing, logistics, transport, inventory).
We replace fragile spreadsheets and manual reporting with proper dashboards and small automations. Never replace people.
CTA on every reply: reply to this email or call/text +1 (214) 997-4331.

You will be given a reply to a cold email. Classify the intent and draft a short, casual reply in the Z & C voice.

INTENT CATEGORIES:
- interested: wants to talk / asks questions / positive signal
- objection_price: too expensive / cost concern
- objection_timing: not now / busy
- objection_authority: not the decision maker
- objection_fit: happy with current setup / don't need
- referral: points to someone else
- unsubscribe: opt-out (auto-handled, just confirm receipt)
- auto_reply: OOO / bounce / no action needed
- question: generic info request

PAINPOINT ANGLES (use in objection drafts):
- price: "we usually start with a fixed-scope pilot — one dashboard or one automation — so you can see the value before signing anything bigger."
- timing: "no rush. when the next quarter-end report takes someone two days to assemble, ping me."
- authority: "totally get it. who's the right person? happy to send them a 2-minute Loom of a similar Power BI rollup, or you can forward this."
- fit: "fair. if reporting ever drifts or one person becomes a single point of failure on a spreadsheet, text me."
- interested: offer a 10-min scoping call or a sample dashboard. Reply or call/text +1 (214) 997-4331.

DRAFTING RULES:
- Under 60 words. Casual, friendly, lowercase subject (3-5 words). NO "demo/AI/free/RE:" in subject.
- Operator language: dashboard, report, spreadsheet, rollup, daily ops, scrap, throughput, on-time, inventory turn. NEVER: leverage, streamline, synergy, solution, circle back, touching base, quick chat.
- Always offer the phone number +1 (214) 997-4331 as an alternative to replying.
- Sign as: "— Z & C" (no formal sign-off block).
- For unsubscribe / auto_reply: return empty subject/body.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { prospect_id, sent_email_id, inbound_message_id, inbound_body, business_name, contact_name } = await req.json();

    if (!inbound_body || !openaiKey) {
      return new Response(JSON.stringify({ error: 'Missing inbound_body or OPENAI_API_KEY' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMsg = `Business: ${business_name || 'Unknown'}\nContact: ${contact_name || 'Unknown'}\n\nReply received:\n${inbound_body.substring(0, 2000)}`;

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'classify_and_draft',
            description: 'Classify reply intent and draft a Z & C Consultants response.',
            parameters: {
              type: 'object',
              properties: {
                intent: { type: 'string', enum: ['interested','objection_price','objection_timing','objection_authority','objection_fit','referral','unsubscribe','auto_reply','question'] },
                confidence: { type: 'number', description: '0 to 1' },
                urgency: { type: 'string', enum: ['high','medium','low'] },
                suggested_subject: { type: 'string', description: 'Short lowercase subject (3-5 words). Empty for unsubscribe/auto_reply.' },
                suggested_body: { type: 'string', description: 'Reply draft under 60 words. Empty for unsubscribe/auto_reply.' },
              },
              required: ['intent','confidence','urgency','suggested_subject','suggested_body'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'classify_and_draft' } },
        max_tokens: 600,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error('AI gateway error:', aiResp.status, t);
      return new Response(JSON.stringify({ error: `AI gateway error: ${aiResp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call returned', JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: 'No classification returned' }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    console.log('Classified:', args.intent, 'confidence:', args.confidence);

    // Skip persistence for unsubscribe / auto_reply (already handled / no action)
    if (args.intent === 'unsubscribe' || args.intent === 'auto_reply') {
      return new Response(JSON.stringify({ success: true, skipped: true, intent: args.intent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from('reply_intents')
      .insert({
        prospect_id: prospect_id || null,
        sent_email_id: sent_email_id || null,
        inbound_message_id: inbound_message_id || null,
        inbound_body: inbound_body.substring(0, 5000),
        intent: args.intent,
        confidence: args.confidence,
        urgency: args.urgency,
        suggested_subject: args.suggested_subject,
        suggested_body: args.suggested_body,
        status: 'new',
      })
      .select()
      .single();

    if (error) throw error;
    return new Response(JSON.stringify({ success: true, reply_intent: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('classify-and-draft-reply error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
