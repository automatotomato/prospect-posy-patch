import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const SYSTEM = `You are an OCR + business-card parser. The user will send an image of a business card.
Extract the contact details and return STRICT JSON with this exact shape:
{
  "business_name": string | null,
  "contact_name": string | null,
  "title": string | null,
  "email": string | null,
  "phone": string | null,
  "website": string | null,
  "address": string | null,
  "city": string | null,
  "state": string | null,
  "industry": string | null,
  "notes": string | null,
  "confidence": "high" | "medium" | "low"
}
Rules:
- Use null when a field is not clearly present.
- Normalize phone numbers to digits and standard separators.
- Strip "http(s)://" and "www." from website.
- Put any extra info (tagline, hours, social handles) into notes.
- Infer industry only if obviously stated; otherwise null.
- Output ONLY the JSON object. No prose, no code fences.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'image (data URL or base64) is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_completion_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the contact details from this business card.' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('OpenAI error', resp.status, errText);
      return new Response(JSON.stringify({ error: `OpenAI ${resp.status}: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    return new Response(JSON.stringify({ extracted: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('extract-business-card error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
