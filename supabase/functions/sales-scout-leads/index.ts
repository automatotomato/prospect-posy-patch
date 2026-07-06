import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ZC_PROFILE } from "../_shared/zc-profile.ts";

const EXCLUDED = [
  "health", "hospital", "clinic", "dental", "medical", "pharma", "pharmacy",
  "insurance", "insurer", "wellness", "chiropract", "physician", "doctor",
  "veterinary", "nursing", "rehab", "therapy", "cosmetic", "dermatol",
];

const STATES: Record<string, { cities: string[] }> = {
  NV: { cities: ["Las Vegas, NV", "Henderson, NV", "Reno, NV", "North Las Vegas, NV", "Sparks, NV"] },
  CA: { cities: ["Los Angeles, CA", "San Diego, CA", "San Jose, CA", "Sacramento, CA", "Fresno, CA", "Long Beach, CA", "Oakland, CA", "Bakersfield, CA", "Anaheim, CA", "Riverside, CA"] },
  TX: { cities: ["Houston, TX", "Dallas, TX", "Austin, TX", "San Antonio, TX", "Fort Worth, TX", "El Paso, TX", "Arlington, TX", "Plano, TX", "Corpus Christi, TX", "Lubbock, TX"] },
};
const STATE_ORDER = ["NV", "CA", "TX"];

// Broad SMB verticals likely to have spreadsheet/reporting pain
const QUERIES = [
  "manufacturing company", "wholesale distributor", "logistics company",
  "construction company", "property management", "accounting firm",
  "law firm", "marketing agency", "field service company", "auto repair shop",
  "commercial cleaning", "HVAC company", "electrician contractor", "landscaping company",
  "real estate brokerage", "staffing agency", "auto dealership", "printing company",
  "equipment rental", "freight broker",
];

const TARGET = 15; // per invocation — call multiple times to reach 50/day
const MAX_CANDIDATES = 60;
const TIME_BUDGET_MS = 110_000; // stay under 150s edge timeout

function isExcluded(text: string) {
  const t = (text || "").toLowerCase();
  return EXCLUDED.some((kw) => t.includes(kw));
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) return false;
  const disposable = ["mailinator", "tempmail", "10minutemail", "guerrillamail", "yopmail", "trashmail"];
  if (disposable.some((d) => e.includes(d))) return false;
  // skip obvious noreply
  if (/(no-?reply|donot-?reply|noreply)/i.test(e)) return false;
  return true;
}

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

async function openaiJson(apiKey: string, system: string, user: string, useWebSearch = false): Promise<any> {
  const body: any = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  };
  // gpt-4o-mini supports temperature; keep it low for determinism
  body.temperature = 0.3;
  if (useWebSearch) {
    // Note: web_search tool is enabled on certain OpenAI models; for gpt-4o-mini we rely on prompted heuristics.
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

async function scrapeText(url: string, paths: string[] = ["", "/contact"]): Promise<string> {
  const results = await Promise.all(paths.map(async (p) => {
    try {
      const u = url.replace(/\/$/, "") + p;
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (LeadScout)" }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) return "";
      const html = await r.text();
      return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000);
    } catch { return ""; }
  }));
  return results.join("\n");
}

function extractEmailsFromText(text: string, domain: string | null): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const filtered = matches
    .map((e) => e.toLowerCase())
    .filter((e) => isValidEmail(e))
    .filter((e) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(e));
  // prefer matching domain
  const unique = Array.from(new Set(filtered));
  if (domain) {
    const matchDomain = unique.filter((e) => e.endsWith("@" + domain));
    if (matchDomain.length) return matchDomain;
  }
  return unique;
}

const GENERIC_PREFIXES = new Set([
  "info","sales","hello","contact","support","admin","office","hr",
  "marketing","billing","careers","team","help","no-reply","noreply",
  "accounts","accounting","service","services","enquiries","inquiries",
  "general","reception","front-desk","frontdesk","feedback","press","media",
]);
function classifyEmail(email: string): "direct" | "general" {
  const local = (email || "").split("@")[0]?.toLowerCase() || "";
  return GENERIC_PREFIXES.has(local) ? "general" : "direct";
}

function pickBestEmail(emails: string[]): string | null {
  if (!emails.length) return null;
  // 1) any personal / decision-maker email first
  const direct = emails.find((e) => classifyEmail(e) === "direct");
  if (direct) return direct;
  // 2) then role-based priority for the least-generic fallback
  const priority = [/^(ceo|founder|owner|president|director|manager)@/, /^(sales|hello|team)@/, /^(info|contact|office|admin)@/];
  for (const re of priority) {
    const hit = emails.find((e) => re.test(e));
    if (hit) return hit;
  }
  return emails[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!googleKey) return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!openaiKey) return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const admin = createClient(url, serviceKey);

    // Load user-defined excluded verticals from discovery settings
    const { data: discRow } = await admin.from("agent_settings").select("setting_value").eq("setting_key", "discovery").maybeSingle();
    const userExcluded: string[] = ((discRow?.setting_value as any)?.excludedVerticals || []).map((s: string) => String(s).toLowerCase());
    const blockedKeywords = [...EXCLUDED, ...userExcluded];
    const isBlocked = (text: string) => {
      const t = (text || "").toLowerCase();
      return blockedKeywords.some((kw) => kw && t.includes(kw));
    };

    // Rotate state cursor
    const { data: cursorRow } = await admin.from("agent_settings").select("*").eq("setting_key", "scout_state_cursor").maybeSingle();
    const lastIdx = (cursorRow?.setting_value as any)?.index ?? -1;
    const nextIdx = (lastIdx + 1) % STATE_ORDER.length;
    const state = STATE_ORDER[nextIdx];
    await admin.from("agent_settings").upsert({ setting_key: "scout_state_cursor", setting_value: { index: nextIdx, state } as any }, { onConflict: "setting_key" });

    const cities = STATES[state].cities;
    const inserted: any[] = [];
    const seenDomains = new Set<string>();
    const seenEmails = new Set<string>();
    let candidatesProcessed = 0;

    // Pull ALL existing leads (across owners) so AI doesn't duplicate uploaded
    // contacts either. Paginate to bypass the default 1000-row cap.
    let offset = 0;
    while (true) {
      const { data: existing, error: exErr } = await admin.from("sales_leads")
        .select("email,website").range(offset, offset + 999);
      if (exErr || !existing || existing.length === 0) break;
      for (const r of existing as any[]) {
        const d = domainFromUrl(r.website);
        if (d) seenDomains.add(d);
        if (r.email) {
          const e = r.email.toLowerCase();
          seenEmails.add(e);
          seenDomains.add(e.split("@")[1] || "");
        }
      }
      if (existing.length < 1000) break;
      offset += 1000;
    }

    // Shuffle queries & cities
    const shuffled = (arr: string[]) => arr.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    const queryPool = shuffled(QUERIES);
    const cityPool = shuffled(cities);

    const startTs = Date.now();
    const timeUp = () => Date.now() - startTs > TIME_BUDGET_MS;

    async function processPlace(p: any, q: string, city: string) {
      const name: string = p.displayName?.text || "";
      const types = (p.types || []).join(" ");
      if (!name || isBlocked(name) || isBlocked(types) || isBlocked(q)) return null;
      const website: string | null = p.websiteUri || null;
      if (!website) return null;
      const domain = domainFromUrl(website);
      if (!domain || seenDomains.has(domain)) return null;
      seenDomains.add(domain); // reserve early to prevent duplicate parallel work

      const text = await scrapeText(website);
      const emails = extractEmailsFromText(text, domain);
      const email = pickBestEmail(emails);
      if (!email) return null;
      if (seenEmails.has(email.toLowerCase())) return null; // dedupe against uploaded + prior AI leads
      seenEmails.add(email.toLowerCase());
      const leadType = classifyEmail(email);

      let summary = "", painHypothesis = "", emailSubject = "", emailBody = "";
      try {
        const ai = await openaiJson(
          openaiKey,
          `You are a B2B SDR for Z & C Consultants. Output strict JSON. Use ONLY the profile below as ground truth — never invent capabilities.\n\n${ZC_PROFILE}`,
          `Business: ${name}\nWebsite: ${website}\nCity: ${city}\nDomain text (truncated):\n${text.slice(0, 2500)}\n\nPick the ONE Z&C capability most relevant to this vertical (Power BI dashboards, MRP/BOM, RPA, forecasting, AR/AP, RAG knowledge agent, ERP integration, etc.) and tie it to a believable spreadsheet/manual-reporting pain.\n\nReturn JSON: { "summary": "1 sentence what they do", "pain_hypothesis": "1 sentence specific reporting/spreadsheet pain they likely face", "email_subject": "short subject (<55 chars)", "email_body": "personalized email, <110 words, plain text, opens with something specific, ties ONE Z&C capability to the pain, ends with a single open question, signs off exactly:\\n— Z & C Consultants\\n+1 (214) 997-4331" }`
        );
        summary = String(ai.summary || "").slice(0, 500);
        painHypothesis = String(ai.pain_hypothesis || "").slice(0, 500);
        emailSubject = String(ai.email_subject || "").slice(0, 200);
        emailBody = String(ai.email_body || "").slice(0, 4000);
      } catch (e) {
        console.error("AI fail", String(e));
        return null;
      }
      if (!emailSubject || !emailBody) return null;

      const addrParts = (p.formattedAddress || "").split(",").map((s: string) => s.trim());
      const cityPart = addrParts[addrParts.length - 3] || city.split(",")[0];

      const { data, error } = await admin.from("sales_leads").insert({
        owner_id: userId,
        business_name: name,
        website,
        email,
        phone: p.nationalPhoneNumber || null,
        city: cityPart,
        state,
        industry: q,
        source: "ai_scout",
        origin: "ai",
        lead_type: leadType,
        status: "drafted",
        stage: "new",
        notes: [summary, painHypothesis].filter(Boolean).join(" • "),
        email_subject: emailSubject,
        email_body: emailBody,
        email_generated_at: new Date().toISOString(),
      }).select().single();

      if (error) { console.error("insert error", error); return null; }
      return data;
    }

    outer:
    for (const city of cityPool) {
      for (const q of queryPool) {
        if (inserted.length >= TARGET || candidatesProcessed >= MAX_CANDIDATES || timeUp()) break outer;

        const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": googleKey,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.types,places.id",
          },
          body: JSON.stringify({ textQuery: `${q} in ${city}`, pageSize: 10 }),
        });
        if (!placesRes.ok) {
          const errTxt = await placesRes.text();
          console.error("Places API error", placesRes.status, errTxt.slice(0, 300));
          return new Response(JSON.stringify({
            error: `Google Places API error (${placesRes.status})`,
            details: errTxt.slice(0, 500),
            hint: "The GOOGLE_PLACES_API_KEY secret appears to be invalid or has restrictions. Update it in project settings.",
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const placesJson = await placesRes.json();
        const places = (placesJson.places || []) as any[];
        candidatesProcessed += places.length;

        // Process this batch of places in parallel
        const results = await Promise.all(places.map((p) => processPlace(p, q, city).catch(() => null)));
        for (const r of results) {
          if (r) inserted.push(r);
          if (inserted.length >= TARGET) break;
        }
      }
    }

    return new Response(JSON.stringify({
      inserted: inserted.length,
      state,
      candidates_processed: candidatesProcessed,
      target: TARGET,
      leads: inserted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
