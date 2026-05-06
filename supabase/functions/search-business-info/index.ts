import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function firecrawlScrape(url: string, apiKey: string): Promise<string> {
  try {
    const candidatePaths = ["", "/contact", "/contact-us", "/about", "/about-us", "/team"];
    let combined = "";
    for (const path of candidatePaths) {
      let target: string;
      try {
        const u = new URL(url);
        target = `${u.origin}${path || u.pathname}`;
      } catch {
        target = url + path;
      }
      const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, formats: ["markdown", "links"], onlyMainContent: false, waitFor: 1500 }),
      });
      if (!resp.ok) {
        if (resp.status === 402) break;
        continue;
      }
      const data = await resp.json();
      const doc = data.data || data;
      if (doc.markdown) combined += `\n\n--- ${path || "/"} ---\n${doc.markdown}`;
      if (combined.length > 14000) break;
    }
    return combined.slice(0, 14000);
  } catch (e) {
    console.warn("Firecrawl scrape failed:", e instanceof Error ? e.message : e);
    return "";
  }
}

async function firecrawlSearch(query: string, apiKey: string): Promise<string> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 4, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    const results: any[] = data.data || data.web || data.results || [];
    return results.map(r => `### ${r.url || ""}\n${r.markdown || r.content || ""}`).join("\n\n").slice(0, 14000);
  } catch (e) {
    console.warn("Firecrawl search failed:", e instanceof Error ? e.message : e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { businessName, phone, website, location } = await req.json();

    if (!businessName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Business name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchContext = [
      businessName,
      location && `located in ${location}`,
      phone && `phone number: ${phone}`,
      website && `website: ${website}`,
    ].filter(Boolean).join(', ');

    console.log('Searching for business info:', searchContext);

    // Step 1: gather raw web content via Firecrawl
    let scraped = "";
    if (FIRECRAWL_API_KEY) {
      if (website) {
        scraped = await firecrawlScrape(website, FIRECRAWL_API_KEY);
      }
      if (scraped.length < 200) {
        const dirQuery = `"${businessName}" ${location || ""} ${phone || ""} (site:yelp.com OR site:bbb.org OR site:yellowpages.com OR site:manta.com OR site:chamberofcommerce.com)`.trim();
        const dirContent = await firecrawlSearch(dirQuery, FIRECRAWL_API_KEY);
        scraped = (scraped + "\n\n" + dirContent).trim();
      }
    }

    // Pre-extract emails as a hint for OpenAI
    const foundEmails = Array.from(new Set((scraped.match(EMAIL_REGEX) || []).map(e => e.toLowerCase())));
    const businessDomain = website ? extractDomain(website) : null;

    const extractionPrompt = `Extract decision-maker contact info for this business from the SCRAPED CONTENT below.

Business: ${searchContext}
Domain: ${businessDomain || "unknown"}
Pre-detected emails on the pages: ${foundEmails.length ? foundEmails.join(", ") : "none"}

SCRAPED CONTENT:
${scraped || "(no content retrieved)"}

Return ONLY JSON with this exact structure:
{
  "email": "BEST decision-maker email — owner/CEO > careers/HR > role-based > generic info@/contact@. Prefer emails on the business's own domain. If a person's name is shown with the company domain but no email, construct firstname@${businessDomain || "domain"}. null if nothing usable.",
  "phone": "found phone or null",
  "address": "full street address or null",
  "contactName": "owner/manager name found or null",
  "contactRole": "their title (Owner, CEO, etc.) or null",
  "website": "official website URL or null",
  "confidence": "high if email is on the business's own domain or pulled from a real mailto: link, medium if role-based on the right domain, low if constructed or generic",
  "sources": ["URLs you took the data from"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a business intelligence extractor. You read scraped website and directory content and return decision-maker contact info. Always return valid JSON. Never invent emails — only return one if it is in the scraped content or can be constructed from a person\'s name + the confirmed company domain.',
          },
          { role: 'user', content: extractionPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `OpenAI API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const outputText: string = aiData.choices?.[0]?.message?.content || '';

    if (!outputText) {
      return new Response(
        JSON.stringify({ success: false, error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(outputText);
    } catch (e) {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not parse AI response', raw: outputText.substring(0, 500) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      parsedData = JSON.parse(jsonMatch[0]);
    }

    const cleanValue = (v: string | null | undefined) => v && v !== 'null' && v !== 'N/A' ? v : null;
    const cleanData = {
      email: cleanValue(parsedData.email),
      phone: cleanValue(parsedData.phone),
      address: cleanValue(parsedData.address),
      contactName: cleanValue(parsedData.contactName),
      contactRole: cleanValue(parsedData.contactRole),
      website: cleanValue(parsedData.website),
      confidence: parsedData.confidence || 'low',
      sources: Array.isArray(parsedData.sources) ? parsedData.sources : [],
    };

    console.log('Returning search results:', JSON.stringify(cleanData));

    return new Response(
      JSON.stringify({ success: true, data: cleanData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Search failed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
