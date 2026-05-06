import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === INTENT-BASED SEARCH QUERIES ===
// 40% weight: High-intent signals (hiring, answering services, 24hr)
const INTENT_QUERIES = [
  "hiring receptionist", "hiring front desk", "hiring phone operator",
  "hiring call center agent", "hiring customer service representative",
  "hiring virtual assistant", "hiring dispatcher",
  "answering service", "virtual receptionist service", "call answering service",
  "24 hour plumber", "24 hour emergency service", "24 hour hvac",
  "24 hour locksmith", "24 hour towing", "after hours medical",
  "after hours veterinary", "after hours dental emergency",
  "emergency restoration service", "emergency water damage",
];

// 40% weight: High-value scaled industries (volume = need)
const SCALED_INDUSTRY_QUERIES = [
  "multi location dental practice", "multi location medical clinic",
  "multi location veterinary", "multi location auto repair",
  "multi location physical therapy", "multi location chiropractic",
  "large property management company", "large real estate brokerage",
  "busy medical office", "high volume law firm",
  "multi location salon", "franchise plumbing company",
  "franchise hvac company", "franchise pest control",
  "regional home services company", "busy urgent care",
  "large insurance agency", "multi office accounting firm",
  "dispatch towing company", "alarm monitoring company",
  "large landscaping company", "regional moving company",
];

// 20% weight: Standard broad types (for variety)
const BROAD_INDUSTRY_TYPES = [
  "plumber", "hvac contractor", "electrician", "general contractor",
  "roofing contractor", "pest control", "dental office", "medical clinic",
  "chiropractor", "veterinarian", "law firm", "insurance agency",
  "real estate agent", "property management", "hair salon", "med spa",
  "auto repair shop", "towing service", "daycare", "fitness studio",
  "city hall", "county office", "school district", "utility company",
  "crm software company", "voip provider", "telecom company",
];

// Hiring-related keywords used for OpenAI enrichment
const HIRING_KEYWORDS = [
  "receptionist", "front desk", "front office", "virtual assistant",
  "call center", "phone representative", "tech support", "customer service representative",
  "answering service", "dispatcher", "appointment setter", "office assistant",
  "intake coordinator", "phone operator", "administrative assistant",
];

interface DiscoverySettings {
  location: string;
  locations?: string[];
  targetCount: number;
}

interface GooglePlace {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
}

interface DiscoveredBusiness {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  yelp: string | null;
  industry: string;
  contactName: string | null;
  contactRole: string | null;
  emailSource?: string;
  hiringPhoneStaff?: boolean;
  hiringDetails?: string;
  fitScore?: number;
  fitReason?: string;
}

// Helper: build weighted search types from intent, scaled, and broad pools
function buildWeightedSearchTypes(configured: string[], count: number): string[] {
  // If user has custom types configured that differ from defaults, respect them
  const isCustomConfig = configured.length > 0 && configured.length < 30;

  if (isCustomConfig) {
    // User configured specific types — use them but shuffle
    const shuffled = [...configured].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Weighted rotation: 40% intent, 40% scaled, 20% broad
  const intentCount = Math.ceil(count * 0.4);
  const scaledCount = Math.ceil(count * 0.4);
  const broadCount = count - intentCount - scaledCount;

  const pick = (arr: string[], n: number) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  };

  return [
    ...pick(INTENT_QUERIES, intentCount),
    ...pick(SCALED_INDUSTRY_QUERIES, scaledCount),
    ...pick(BROAD_INDUSTRY_TYPES, broadCount),
  ].sort(() => Math.random() - 0.5);
}

// Helper: extract domain from a URL
function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Helper: extract & rank real email addresses from page text/html using Firecrawl
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JUNK_EMAIL_DOMAINS = /(sentry\.io|wixpress\.com|godaddy\.com|squarespace\.com|example\.com|domain\.com|yourdomain|test\.com|email\.com|sample\.com)/i;
const JUNK_LOCAL_PARTS = /(noreply|no-reply|donotreply|do-not-reply|postmaster|mailer-daemon|abuse|webmaster@.*\.gov)/i;

function rankEmail(email: string, businessDomain: string | null): number {
  const lower = email.toLowerCase();
  if (JUNK_EMAIL_DOMAINS.test(lower) || JUNK_LOCAL_PARTS.test(lower)) return -1;
  const [local, domain] = lower.split("@");
  if (!local || !domain) return -1;
  let score = 0;
  // Strongly prefer the business's own domain
  if (businessDomain && (domain === businessDomain || domain.endsWith("." + businessDomain) || businessDomain.endsWith("." + domain))) score += 100;
  // Decision-maker first names get top tier
  if (/^(owner|founder|ceo|president|gm|manager|director|admin|principal)$/.test(local)) score += 40;
  // Personal-looking (firstname or firstname.lastname)
  if (/^[a-z]+(\.[a-z]+)?$/.test(local) && local.length <= 20 && !/^(info|sales|contact|support|hello|office|admin|service|hr|careers|jobs|billing|accounts)$/.test(local)) score += 30;
  // Hiring/HR
  if (/^(careers|hr|recruiting|jobs|hiring|talent|people)$/.test(local)) score += 20;
  // Sales / scheduling roles
  if (/^(sales|partnerships|appointments|scheduling|bookings|service|office)$/.test(local)) score += 15;
  // Generic but acceptable
  if (/^(info|contact|hello|hi|inquiries|admin|reception)$/.test(local)) score += 5;
  // Penalize support / billing
  if (/^(support|help|billing|accounts|noreply|no-reply)$/.test(local)) score -= 10;
  return score;
}

// Search public business directories (Yelp, BBB, Yellow Pages, Chamber, MapQuest, Manta, etc.)
// for emails, contact names, and a usable website. Uses Firecrawl Search + scrape in one call.
async function findEmailViaPublicDirectories(
  business: { name: string; address: string; phone: string | null; website: string | null },
  apiKey: string,
): Promise<{ email: string | null; contactName: string | null; website: string | null; allFound: string[] }> {
  const businessDomain = business.website ? extractDomain(business.website) : null;
  const found = new Set<string>();
  let bestContactName: string | null = null;
  let discoveredWebsite: string | null = null;

  // Build a directory-targeted query. site: filters keep us on trusted public directories.
  const cityState = business.address.split(",").slice(-2).join(",").trim();
  const directoryQuery = `"${business.name}" ${cityState} ${business.phone || ""} (site:yelp.com OR site:bbb.org OR site:yellowpages.com OR site:manta.com OR site:mapquest.com OR site:chamberofcommerce.com OR site:foursquare.com OR site:angi.com OR site:thumbtack.com)`.trim();

  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: directoryQuery,
        limit: 4,
        scrapeOptions: { formats: ["markdown", "links"] },
      }),
    });
    if (!resp.ok) {
      if (resp.status === 402) console.warn("Firecrawl directories: 402 insufficient credits");
      return { email: null, contactName: null, website: null, allFound: [] };
    }
    const data = await resp.json();
    const results: any[] = data.data || data.web || data.results || [];

    for (const r of results) {
      const md: string = r.markdown || r.content || "";
      const links: string[] = Array.isArray(r.links) ? r.links : [];
      const haystack = `${md}\n${links.join("\n")}`;

      // Emails: mailto + plain text
      for (const m of haystack.matchAll(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)) found.add(m[1].toLowerCase());
      for (const m of haystack.match(EMAIL_REGEX) || []) found.add(m.toLowerCase());

      // Discover an external website link (not the directory itself)
      if (!discoveredWebsite) {
        const skipHosts = /(yelp|bbb|yellowpages|manta|mapquest|chamberofcommerce|foursquare|angi|thumbtack|google|facebook|instagram|linkedin|twitter|x\.com)\./i;
        for (const link of links) {
          try {
            const u = new URL(link);
            if (!skipHosts.test(u.hostname) && u.protocol.startsWith("http")) {
              discoveredWebsite = `${u.protocol}//${u.hostname}`;
              break;
            }
          } catch { /* ignore */ }
        }
      }

      // Try to grab an "Owner: Name" or "Contact: Name" hint from BBB / Yellow Pages
      if (!bestContactName) {
        const m = md.match(/(?:Owner|Principal|Contact|Manager|President)\s*:\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        if (m) bestContactName = m[1];
      }
    }
  } catch (e) {
    console.warn(`Firecrawl directory search failed for ${business.name}:`, e instanceof Error ? e.message : e);
  }

  const ranked = [...found]
    .map(e => ({ email: e, score: rankEmail(e, businessDomain || (discoveredWebsite ? extractDomain(discoveredWebsite) : null)) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  return {
    email: ranked.length > 0 ? ranked[0].email : null,
    contactName: bestContactName,
    website: discoveredWebsite,
    allFound: [...found],
  };
}

async function findEmailViaFirecrawl(website: string, apiKey: string): Promise<{ email: string | null; allFound: string[]; markdown: string }> {
  const businessDomain = extractDomain(website);
  // Try the homepage first, then /contact, /about, /team — common email locations
  const candidatePaths = ["", "/contact", "/contact-us", "/about", "/about-us", "/team", "/staff"];
  const found = new Set<string>();
  let combinedMarkdown = "";

  for (const path of candidatePaths) {
    let target: string;
    try {
      const u = new URL(website);
      target = `${u.origin}${path || u.pathname}`;
    } catch {
      target = website + path;
    }
    try {
      const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: target,
          formats: ["markdown", "html", "links"],
          onlyMainContent: false,
          waitFor: 1500,
        }),
      });
      if (!resp.ok) {
        // 402 = no credits, bail out for the whole call
        if (resp.status === 402) {
          console.warn("Firecrawl: 402 insufficient credits");
          return { email: null, allFound: [], markdown: combinedMarkdown };
        }
        continue;
      }
      const data = await resp.json();
      const doc = data.data || data; // SDK vs REST shape
      if (doc.markdown) combinedMarkdown += `\n\n--- ${path || "/"} ---\n${doc.markdown}`;
      const haystacks: string[] = [
        doc.markdown || "",
        doc.html || "",
        ...(Array.isArray(doc.links) ? doc.links : []),
      ];
      for (const text of haystacks) {
        if (!text) continue;
        // Catch mailto: links explicitly (highest signal)
        const mailtoMatches = String(text).matchAll(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi);
        for (const m of mailtoMatches) found.add(m[1].toLowerCase());
        // Plain-text email regex
        const matches = String(text).match(EMAIL_REGEX) || [];
        for (const e of matches) found.add(e.toLowerCase());
      }
      // If we found at least one email on the homepage with the business domain, stop early
      if (path === "" && [...found].some(e => businessDomain && e.endsWith("@" + businessDomain))) break;
    } catch (e) {
      console.warn(`Firecrawl scrape failed for ${target}:`, e instanceof Error ? e.message : e);
    }
  }

  const ranked = [...found]
    .map(e => ({ email: e, score: rankEmail(e, businessDomain) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  return {
    email: ranked.length > 0 ? ranked[0].email : null,
    allFound: [...found],
    markdown: combinedMarkdown.slice(0, 12000),
  };
}

// Helper: construct a role-based fallback email from domain + industry
function constructFallbackEmail(domain: string, industry: string, isHiring: boolean): string {
  const ind = industry.toLowerCase();

  // If hiring signal detected, try careers/hr first
  if (isHiring) {
    return `careers@${domain}`;
  }
  // SaaS / Software
  if (ind.match(/crm|hubspot|salesforce|zoho|software|saas|automation|accounting software|quickbooks|payroll|voip|telecom|phone system/)) {
    return `info@${domain}`;
  }
  // Government
  if (ind.match(/city hall|county|water district|public works|housing|transit|school district|parks|government|municipal/)) {
    return `admin@${domain}`;
  }
  // Agencies
  if (ind.match(/marketing.*agenc|digital.*agenc|agency/)) {
    return `info@${domain}`;
  }
  // Medical / Dental
  if (ind.match(/dental|medical|chiropract|physical therapy|veterinar|optometrist|orthodont|dermatolog|urgent care|mental health/)) {
    return `office@${domain}`;
  }
  // Legal / Professional
  if (ind.match(/law firm|accounting firm|insurance|real estate|financial advisor|tax preparer|mortgage/)) {
    return `office@${domain}`;
  }
  // Beauty / Wellness
  if (ind.match(/salon|barber|spa|nail|massage|tattoo|fitness|yoga|personal trainer/)) {
    return `appointments@${domain}`;
  }
  // Automotive
  if (ind.match(/auto|towing|tire|car|oil change|transmission|motorcycle/)) {
    return `service@${domain}`;
  }
  // Default — info@ is acceptable as last resort
  return `info@${domain}`;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    let isAuthorized = token === supabaseKey;
    if (!isAuthorized) {
      const supabaseAuth = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      isAuthorized = !userError && !!user;
    }
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));

    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!googleApiKey) throw new Error("GOOGLE_PLACES_API_KEY not configured");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch settings
    console.log("Fetching agent settings...");
    const { data: settingsData, error: settingsError } = await supabase
      .from("agent_settings")
      .select("setting_key, setting_value");

    if (settingsError) console.error("Failed to fetch settings:", settingsError);

    const discoverySettings: DiscoverySettings = settingsData?.find(
      s => s.setting_key === "discovery"
    )?.setting_value as DiscoverySettings || { location: "Las Vegas, NV", targetCount: 50 };

    const businessTypes: string[] = settingsData?.find(
      s => s.setting_key === "business_types"
    )?.setting_value as string[] || [...INTENT_QUERIES, ...SCALED_INDUSTRY_QUERIES, ...BROAD_INDUSTRY_TYPES];

    const location = body.location || discoverySettings.location;
    const targetCount = body.targetCount || discoverySettings.targetCount;
    const searchTypes = body.businessTypes || businessTypes;

    const dripSettings = settingsData?.find(
      s => s.setting_key === "drip_settings"
    )?.setting_value as { interval_minutes?: number } || {};
    const dripIntervalMinutes = dripSettings.interval_minutes || 5;

    console.log(`Settings - Location: ${location}, Target: ${targetCount}, Types: ${searchTypes.length}, Drip: ${dripIntervalMinutes}min`);

    // Daily run-cap to prevent runaway AI/Cloud spend.
    // Pass { force: true } in body to override (for manual admin triggers).
    const DAILY_RUN_CAP = 5;
    if (!body.force) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count: todayRuns } = await supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay.toISOString());
      if ((todayRuns ?? 0) >= DAILY_RUN_CAP) {
        console.log(`Daily discovery cap reached (${todayRuns}/${DAILY_RUN_CAP}). Skipping.`);
        return new Response(JSON.stringify({
          error: `Daily discovery cap reached (${DAILY_RUN_CAP}/day). Pass { force: true } to override.`,
          capped: true,
          runs_today: todayRuns,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Create agent run record
    const { data: agentRun, error: runError } = await supabase
      .from("agent_runs")
      .insert({ search_location: location, search_types: searchTypes, status: "running" })
      .select()
      .single();

    if (runError) throw new Error("Failed to create agent run");

    console.log(`Starting discovery run ${agentRun.id} for ${location}`);

    // Get existing prospects to avoid duplicates (paginate to get all)
    let existingProspects: { business_name: string; phone: string | null; email: string | null }[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page } = await supabase
        .from("prospects")
        .select("business_name, phone, email")
        .range(offset, offset + pageSize - 1);
      if (!page || page.length === 0) break;
      existingProspects = existingProspects.concat(page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    const existingNames = new Set(existingProspects?.map(p => p.business_name.toLowerCase()) || []);
    const existingPhones = new Set(existingProspects?.map(p => p.phone).filter(Boolean) || []);
    const existingEmails = new Set(existingProspects?.map(p => p.email).filter(Boolean) || []);

    let businessesCreated = 0;
    let emailsGenerated = 0;

    // Build weighted search types: 40% intent, 40% scaled, 20% broad
    const typesToSearch = buildWeightedSearchTypes(searchTypes, Math.min(12, searchTypes.length));
    console.log(`🎯 Weighted search types: ${typesToSearch.join(", ")}`);

    // ===== PHASE 1: Use Google Places API to find REAL businesses =====
    const allDiscovered: DiscoveredBusiness[] = [];
    const seenPlaceNames = new Set<string>();

    for (const bizType of typesToSearch) {
      if (allDiscovered.length >= targetCount * 2) break;

      const query = `${bizType} in ${location}`;
      console.log(`🔍 Google Places search: "${query}"`);

      try {
        const placesResp = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": googleApiKey,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryType,places.primaryTypeDisplayName",
          },
          body: JSON.stringify({
            textQuery: query,
            maxResultCount: 20,
            languageCode: "en",
          }),
        });

        if (!placesResp.ok) {
          const errText = await placesResp.text();
          console.error(`Google Places API error (${placesResp.status}):`, errText);
          if (placesResp.status === 429) {
            await new Promise(r => setTimeout(r, 3000));
          }
          continue;
        }

        const placesData = await placesResp.json();
        const places: GooglePlace[] = placesData.places || [];

        console.log(`  Found ${places.length} places for "${bizType}"`);

        for (const place of places) {
          const name = place.displayName?.text;
          if (!name) continue;

          const nameLower = name.toLowerCase().trim();
          if (seenPlaceNames.has(nameLower) || existingNames.has(nameLower)) continue;
          seenPlaceNames.add(nameLower);

          const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || null;
          if (phone && existingPhones.has(phone)) continue;

          allDiscovered.push({
            name,
            address: place.formattedAddress || null,
            phone,
            email: null, // Will be found in Phase 2
            website: place.websiteUri || null,
            facebook: null,
            instagram: null,
            linkedin: null,
            yelp: null,
            industry: bizType,
            contactName: null,
            contactRole: null,
          });
        }
      } catch (err) {
        console.error(`Error searching Google Places for "${bizType}":`, err);
      }

      // Small delay between API calls
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`📍 Google Places found ${allDiscovered.length} total businesses`);

    // Trim to target
    const candidateBusinesses = allDiscovered.slice(0, targetCount);

    // ===== PHASE 2: Find decision-maker emails (Firecrawl scrape → directories → OpenAI enrichment → constructed) =====
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const enrichedBusinesses: DiscoveredBusiness[] = [];

    for (const biz of candidateBusinesses) {
      try {
        let email: string | null = null;
        let emailSource = "search";
        let contactName: string | null = null;
        let contactRole: string | null = null;

        let scrapedMarkdown = "";
        // 2a) Firecrawl: scrape the actual website for real, verified emails (highest deliverability)
        if (firecrawlKey && biz.website) {
          const { email: scraped, allFound, markdown } = await findEmailViaFirecrawl(biz.website, firecrawlKey);
          scrapedMarkdown = markdown;
          if (scraped) {
            email = scraped;
            emailSource = "firecrawl";
            console.log(`🔥 Firecrawl found ${scraped} for ${biz.name} (${allFound.length} on site)`);
          }
        }

        // 2a-bis) Public directories: when site-scrape didn't yield an email (no website, or nothing on it),
        // search Yelp / BBB / Yellow Pages / Manta / Chamber via Firecrawl Search + scrape.
        if (!email && firecrawlKey) {
          const dir = await findEmailViaPublicDirectories(
            { name: biz.name, address: biz.address, phone: biz.phone, website: biz.website },
            firecrawlKey,
          );
          if (dir.email) {
            email = dir.email;
            emailSource = "directories";
            console.log(`📒 Directories found ${dir.email} for ${biz.name} (${dir.allFound.length} candidates)`);
          }
          if (dir.contactName && !contactName) contactName = dir.contactName;
          // Save a website discovered from directories so later steps can use it
          if (dir.website && !biz.website) biz.website = dir.website;
        }

        // 2b) OpenAI: extract decision-maker email, socials, hiring signals & fit score
        // from the actual scraped website content (Firecrawl markdown). No live web search —
        // OpenAI reasons over the real page text we already pulled.
        if (openaiKey && scrapedMarkdown.trim().length > 50) {
          const businessDomain = biz.website ? extractDomain(biz.website) : null;
          const hiringKeywordsStr = HIRING_KEYWORDS.join(", ");
          const extractionPrompt = `You are analyzing the SCRAPED WEBSITE CONTENT of a business to extract contact info, social profiles, hiring signals, and fit-score it for an AI phone answering service.

Business: ${biz.name}
Address: ${biz.address || "unknown"}
Phone: ${biz.phone || "unknown"}
Website: ${biz.website || "unknown"}
Domain: ${businessDomain || "unknown"}

SCRAPED WEBSITE CONTENT (truncated):
${scrapedMarkdown}

TASKS — return ONLY JSON (no markdown):
1. email: BEST decision-maker email visible on the page (owner/CEO/manager > careers/hr > role-based > generic). If a person's name is shown with the company domain but no email, construct firstname@${businessDomain || "domain"}. Otherwise null.
2. contactName: full name of an owner/manager/decision-maker found on the page, or null.
3. contactRole: their title (Owner, CEO, Manager, etc.) or null.
4. linkedinUrl, facebookUrl, instagramUrl, yelpUrl: full URLs found in the page (footer/header/contact). null if absent.
5. hiringPhoneStaff (boolean): true ONLY if the page references hiring for any of: ${hiringKeywordsStr}.
6. hiringDetails: short description of the hiring signal, or null.
7. fitScore (1-10) for an AI phone answering service: +3 high call volume (multi-location, 24/7, emergency, appointment-based); +3 actively hiring phone/reception; +2 uses an answering service / IVR; +1 larger business; +1 high-call industry (medical, legal, home services, property mgmt). Lower for solo / online-only.
8. fitReason: one short sentence explaining the score.

JSON shape: {"email":null,"contactName":null,"contactRole":null,"linkedinUrl":null,"facebookUrl":null,"instagramUrl":null,"yelpUrl":null,"hiringPhoneStaff":false,"hiringDetails":null,"fitScore":5,"fitReason":""}`;

          try {
            const oResp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You extract decision-maker contact info, social profiles, hiring signals, and fit-score leads from scraped website text. Return only valid JSON." },
                  { role: "user", content: extractionPrompt },
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 700,
              }),
            });

            if (oResp.ok) {
              const oData = await oResp.json();
              const content = oData.choices?.[0]?.message?.content || "";
              try {
                const parsed = JSON.parse(content);
                // Only take OpenAI's email if Firecrawl/directories didn't already find a real one
                if (!email && parsed.email && parsed.email !== "null" && /@/.test(parsed.email)) {
                  email = String(parsed.email).toLowerCase();
                  emailSource = "openai";
                }
                if (parsed.contactName && parsed.contactName !== "null") contactName = parsed.contactName;
                if (parsed.contactRole && parsed.contactRole !== "null") contactRole = parsed.contactRole;
                biz.hiringPhoneStaff = parsed.hiringPhoneStaff === true;
                biz.hiringDetails = parsed.hiringDetails && parsed.hiringDetails !== "null" ? parsed.hiringDetails : null;
                biz.fitScore = typeof parsed.fitScore === "number" ? parsed.fitScore : 5;
                biz.fitReason = parsed.fitReason && parsed.fitReason !== "null" ? parsed.fitReason : null;
                const cleanUrl = (v: string | null | undefined) => v && v !== "null" && typeof v === "string" && v.startsWith("http") ? v : null;
                biz.linkedin = cleanUrl(parsed.linkedinUrl) || biz.linkedin;
                biz.facebook = cleanUrl(parsed.facebookUrl) || biz.facebook;
                biz.instagram = cleanUrl(parsed.instagramUrl) || biz.instagram;
                biz.yelp = cleanUrl(parsed.yelpUrl) || biz.yelp;
              } catch (e) {
                console.error(`Failed to parse OpenAI extraction for ${biz.name}:`, e);
              }
            } else {
              console.error(`OpenAI extraction failed for ${biz.name}: ${oResp.status}`);
            }
          } catch (e) {
            console.error(`OpenAI extraction error for ${biz.name}:`, e);
          }

          // small pacing
          await new Promise(r => setTimeout(r, 200));
        }

        // Fallback: construct role-based email from website domain (last resort)
        if (!email && biz.website) {
          const domain = extractDomain(biz.website);
          if (domain) {
            email = constructFallbackEmail(domain, biz.industry, biz.hiringPhoneStaff || false);
            emailSource = "constructed";
            console.log(`🔧 Constructed fallback email for ${biz.name}: ${email}${biz.hiringPhoneStaff ? " (hiring signal detected)" : ""}`);
          }
        }

        // Skip businesses without an email
        if (!email) {
          console.log(`⚠️ No email found for ${biz.name} (no website either), skipping`);
          continue;
        }

        if (existingEmails.has(email)) continue;

        // Filter: only keep leads with fitScore >= 5 (saves OpenAI credits)
        const score = biz.fitScore || 5;
        if (score < 5) {
          console.log(`⏭️ Skipping ${biz.name} — fitScore ${score}/10 (${biz.fitReason || "low fit"})`);
          continue;
        }

        enrichedBusinesses.push({
          ...biz,
          email,
          contactName,
          contactRole,
          emailSource,
        });
      } catch (err) {
        console.error(`Error enriching ${biz.name}:`, err);
      }
    }

    // Sort: highest fitScore first, then hiring leads
    enrichedBusinesses.sort((a, b) => {
      const scoreA = a.fitScore || 5;
      const scoreB = b.fitScore || 5;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.hiringPhoneStaff ? 1 : 0) - (a.hiringPhoneStaff ? 1 : 0);
    });

    console.log(`📧 Enriched ${enrichedBusinesses.length} businesses with emails`);

    // ===== PHASE 3: Create prospects and generate tailored emails =====
    for (const biz of enrichedBusinesses) {
      try {
        const { data: prospect, error: prospectError } = await supabase
          .from("prospects")
          .insert({
            business_name: biz.name,
            location: biz.address || location,
            phone: biz.phone,
            email: biz.email,
            website: biz.website,
            facebook_url: biz.facebook || null,
            instagram_url: biz.instagram || null,
            linkedin_url: biz.linkedin || null,
            yelp_url: biz.yelp || null,
            source: "cold_call",
            status: "new",
            industry: biz.industry || null,
            contact_name: biz.contactName || null,
            notes: `Discovered by outreach agent. Fit Score: ${biz.fitScore || 5}/10${biz.fitReason ? ` — ${biz.fitReason}` : ""}. Industry: ${biz.industry || "unknown"}${biz.contactRole ? `. Contact: ${biz.contactRole}` : ""}. Email: ${biz.emailSource || "search"}${biz.hiringPhoneStaff ? `. 🔥 HIRING: ${biz.hiringDetails || "Hiring for phone/reception roles"}` : ""}`,
          })
          .select()
          .single();

        if (prospectError) {
          console.error(`Failed to create prospect for ${biz.name}:`, prospectError);
          continue;
        }

        businessesCreated++;
        console.log(`✅ Created prospect: ${biz.name}`);

        // Generate tailored email
        if (biz.email) {
          try {
            const industry = biz.industry || "general";
            const contactName = biz.contactName || null;
            const contactRole = (biz.contactRole || "").toLowerCase();
            const bizNameLower = biz.name.toLowerCase();

            // Detect business category — hiring signal overrides
            let bizCategory = "service_business";
            if (biz.hiringPhoneStaff) bizCategory = "hiring_phone_staff";
            else if (bizNameLower.match(/crm|hubspot|salesforce|zoho|pipedrive|freshsales/)) bizCategory = "saas_crm";
            else if (bizNameLower.match(/quickbooks|xero|freshbooks|accounting software|payroll/)) bizCategory = "saas_accounting";
            else if (bizNameLower.match(/voip|telecom|phone system|ringcentral|dialpad|grasshopper/)) bizCategory = "saas_phone";
            else if (bizNameLower.match(/utility|electric|gas|water|internet provider|municipal/)) bizCategory = "utility";
            else if (bizNameLower.match(/city hall|county|water district|public works|housing authority|transit|school district|parks.*rec|government|municipal office|planning department|building department|health department/)) bizCategory = "government";
            else if (bizNameLower.match(/marketing.*agenc|digital.*agenc/)) bizCategory = "agency";

            // Detect contact type
            let contactType = "general";
            if (contactRole.match(/owner|founder|ceo|president|principal/)) contactType = "owner";
            else if (contactRole.match(/partner|bd|bizdev|alliance|integration/)) contactType = "partnerships";
            else if (contactRole.match(/hr|human resource|people|talent|recruit/)) contactType = "hr";
            else if (contactRole.match(/ir|investor|finance|cfo/)) contactType = "investor_relations";
            else if (contactRole.match(/coo|vp|director|manager|gm|general manager/)) contactType = "decision_maker";
            else if (contactRole.match(/sales|revenue|account/)) contactType = "sales";
            else if (contactRole.match(/city manager|administrator|clerk|commissioner|superintendent/)) contactType = "government_official";

            // Value props by category + contact type
            const valueProps: Record<string, Record<string, string>> = {
              saas_crm: {
                owner: "Your customers' teams are fielding calls all day. When those calls go unanswered, their clients move on to a competitor. We built AI phone agents that work alongside their staff, and a native integration with your CRM could be a real differentiator.",
                partnerships: "The businesses using your CRM rely on their phones for revenue. When they miss calls, they lose customers to the next option on Google. Our AI picks up, books appointments, and logs everything. I think there's a strong integration fit here.",
                decision_maker: "Your users lose leads every time a call goes to voicemail. Our AI works alongside their team as a cost-effective alternative to hiring a VA or call center, and the data would flow naturally into your CRM.",
                general: "We're an AI company that helps teams make sure no call goes unanswered. Your CRM users lose business when calls get missed. I wanted to explore whether an integration makes sense.",
              },
              saas_accounting: {
                owner: "Service businesses using your platform are losing jobs every time a call goes to voicemail. Our AI picks up, books the job, and captures the details. It's a fraction of the cost of a VA, and the data would pair naturally with invoicing and job tracking.",
                partnerships: "Your customers' biggest leak is missed calls. When nobody answers, the customer moves on. Our AI handles routine calls and captures job details in real-time. An integration could plug that gap for your users.",
                general: "We help service businesses stop losing customers to missed calls. Our AI is a cost-effective alternative to a VA or call center. I think there's a natural integration with your platform.",
              },
              saas_phone: {
                owner: "Your customers' teams get overwhelmed during peak hours and after close. When calls go to voicemail, their customers call the next business. Our AI handles overflow and after-hours as a cost-effective layer on top of your phone system.",
                partnerships: "When your customers' lines are busy or closed, those callers move on to a competitor. Our AI works alongside their existing phone system to pick up the overflow. A partnership could offer your users instant AI backup.",
                general: "We help businesses stop losing callers to voicemail and competitors. Our AI works on top of existing phone systems as a cost-effective alternative to staffing up. I wanted to explore a partnership.",
              },
              utility: {
                owner: "During outages and billing cycles, call volume spikes and hold times climb. Residents who can't get through call back frustrated, or don't call back at all. Our AI handles the routine questions at a fraction of the cost of adding call center staff.",
                decision_maker: "When call volume spikes, your team is stretched thin and hold times go up. Our AI handles routine inquiries instantly so your staff can focus on the complex issues. It costs a fraction of expanding your call center.",
                general: "We help organizations with high call volumes make sure every caller gets an answer. Our AI is a cost-effective alternative to staffing up or expanding call center contracts.",
              },
              government: {
                government_official: "When residents can't get through, they lose trust. During busy periods, calls pile up and staff gets overwhelmed. Our AI handles the routine questions 24/7 at a fraction of the cost of adding call center support.",
                decision_maker: "Your staff is pulled in every direction, and when phones go unanswered, residents notice. Our AI handles routine calls so your team can focus on complex issues. It's a cost-effective alternative to hiring more phone staff.",
                general: "We help government offices make sure residents always get an answer. Our AI costs a fraction of call center support and handles routine inquiries 24/7.",
              },
              agency: {
                owner: "Your clients lose customers every time a call goes to voicemail. We built AI that picks up, books appointments, and even sends quotes to callers in real-time. It's a cost-effective solution you could offer as a referral or white-label.",
                partnerships: "When your clients miss calls, their customers call the competition. Our AI is a cost-effective alternative to VAs and call centers. Agencies like yours are a natural fit for a referral or white-label partnership.",
                general: "We help service businesses stop losing customers to missed calls. Our AI is a fraction of the cost of a VA. I think your agency clients could benefit, and wanted to explore a partnership.",
              },
              hiring_phone_staff: {
                owner: "I saw you're looking for someone to help with your phones. Before you spend on another hire, our AI costs a fraction of a VA and picks up every call 24/7. It can back up whoever's on the phones so you never lose a customer to a missed call.",
                hr: "I noticed you're hiring for a phone/reception role. Our AI is a cost-effective alternative that works alongside your team. It handles routine calls, books appointments, and makes sure no customer moves on to a competitor while you're busy.",
                decision_maker: "I saw you're looking to add phone coverage. Our AI costs a fraction of a new hire and never misses a call. When your lines are busy, the callers who can't get through are calling your competitors.",
                general: "I saw you're looking for help covering your phones. Our AI is a cost-effective alternative to a VA or call center. It makes sure no customer moves on to a competitor because they couldn't reach you.",
              },
              service_business: {
                owner: "When your phones are busy or nobody picks up, that customer calls the next business on Google. We're a cost-effective alternative to hiring a VA or call center. Our AI picks up every call, books appointments, and transfers to your team when someone asks for a person.",
                hr: "When calls go unanswered, customers move on to a competitor. Our AI is a cost-effective way to back up your phone team. It handles routine calls, books appointments, and transfers to a real person when asked.",
                investor_relations: "We're a growing AI company helping service businesses stop losing customers to missed calls. Our AI is a cost-effective alternative to VAs and call centers. I'd love to share what we're building.",
                decision_maker: "Every missed call is a customer who might call your competitor instead. Our AI picks up every call, books appointments, and transfers to your team when needed. It costs a fraction of a VA or call center.",
                general: "We're an AI company based out of Las Vegas. When your phones are busy or go to voicemail, those customers call the next business. Our AI is a cost-effective alternative to a VA or call center that makes sure no one moves on.",
              },
            };

            const categoryProps = valueProps[bizCategory] || valueProps.service_business;
            const valueProp = categoryProps[contactType] || categoryProps.general || categoryProps.owner || "We're an AI company that helps businesses support their team with intelligent call handling.";

            // Build CTA based on contact type
            let cta = "Could you point us to the right person to chat with about this? Happy to work around their schedule.";
            if (contactType === "owner") cta = "Would you be open to a quick conversation about this? Happy to work around your schedule.";
            else if (contactType === "partnerships") cta = "Would love to explore whether there's a partnership fit here. Who would be the best person to connect with on your side?";
            else if (contactType === "investor_relations") cta = "I'd welcome the chance to share more about what we're building. Would there be a good time to connect?";
            else if (contactType === "hr") cta = "Could you point me to the right person who handles operations or technology decisions? Appreciate it.";
            else if (contactType === "government_official") cta = "Would you be open to a conversation about how this could work for your department? Happy to work around your schedule.";

            // Override CTA for hiring leads
            if (biz.hiringPhoneStaff) {
              cta = "Would it make sense to chat about this? Happy to show you how it works alongside your team.";
            }

            const greeting = contactName ? `Hi ${contactName.split(" ")[0]},` : `Hi ${biz.name} team,`;

            const systemPrompt = `You are Alex Perez, founder of Automate Planet. You write personalized, human emails. Every email must feel unique to the recipient.

CRITICAL: Do NOT use a template. Do NOT write generic emails. Each email must be specifically tailored to THIS business, THIS person, and THIS industry. Every email must be UNIQUELY generated — vary sentence structure, opening lines, and angles each time.

THE EMAIL YOU WRITE MUST:
- Open with: "${greeting}"
- Include a value proposition tailored to their specific business: "${valueProp}"
- End with this CTA: "${cta}"
- Close with: "Alex Perez\\nAutomate Planet | (702) 863-3200\\nBook a time: https://calendly.com/automateplanet/15"

POSITIONING RULES:
- NEVER suggest replacing staff, saving on salary, or eliminating positions
- Position AI as a COST-EFFECTIVE ALTERNATIVE to hiring VAs or call centers
- Emphasize that when customers can't reach them, they move on to a competitor
- Mention that AI handles routine calls so the team can focus on what matters
- Mention that when a caller asks for a human, AI transfers to their extension or cell phone
- If the team member doesn't answer, both caller and team get notified with full context so callbacks are warmer
- During calls, AI can send texts, emails, calendar links, proposals, or quotes to callers in real-time
- Reference a specific pain point relevant to their industry and frame it as an opportunity

WRITING RULES:
- 50-80 words before signature. Shorter wins.
- Friendly, warm, conversational. Sound like a real person writing to one specific person.
- Reference something specific about their business, industry, or role. Make them feel this was written ONLY for them.
- Touch on a pain point relevant to their industry (missed calls, busy phones, lost customers, voicemail overload)
- NO "5-minute call" or time pressure
- NO em dashes. Use commas or periods.
- NO jargon: "leverage", "optimize", "streamline", "cutting-edge", "synergy"
- NO "I noticed", "I came across", "I hope this finds you well"
- NO bullet points or lists
- Subject line: 3-6 words, natural, Title Case. Must relate to THEIR specific situation, not generic.
- If it sounds like it could be sent to anyone, REWRITE IT.

Return JSON: {"subject": "...", "body": "..."}`;

            const hiringContext = biz.hiringPhoneStaff ? `\nHIRING SIGNAL: ${biz.hiringDetails || "Currently hiring for phone/reception roles"}. This is a HIGH PRIORITY lead. Reference that you saw they're looking to add phone coverage and position AI as a great backup for their team, whether or not they fill the role.` : "";

            const emailPrompt = `Write a personalized outreach email for:

Business: ${biz.name}
Contact: ${contactName || "unknown"}
Role: ${contactRole || "unknown"}
Location: ${biz.address || location}
Industry: ${industry}
Business Category: ${bizCategory}
Website: ${biz.website || "none"}${hiringContext}

This is a ${bizCategory === "hiring_phone_staff" ? "business actively hiring for phone/reception roles, pitch AI as a better alternative to hiring" : bizCategory === "service_business" ? "service business we want as a client" : bizCategory.startsWith("saas") ? "SaaS company we want as an integration partner" : bizCategory === "government" ? "government agency we want to help modernize" : bizCategory === "utility" ? "utility company that handles massive call volumes" : bizCategory === "agency" ? "marketing agency we want as a referral partner" : "business we want to work with"}.

The email must feel like it was written specifically for ${contactName || biz.name}. Use the value prop and CTA from the system prompt. Return valid JSON.`;

            const emailResp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: emailPrompt },
                ],
                temperature: 0.7,
                max_tokens: 1000,
              }),
            });

            if (!emailResp.ok) {
              console.error(`Email gen API error: ${emailResp.status}`);
              continue;
            }

            const emailData = await emailResp.json();
            const emailContent = emailData.choices?.[0]?.message?.content;

            if (emailContent) {
              let cleaned = emailContent.trim();
              if (cleaned.startsWith("```")) cleaned = cleaned.replace(/```json?\n?/g, "").replace(/```/g, "");
              const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const emailSubject = parsed.subject;
                const emailBody = parsed.body;

                if (emailSubject && emailBody) {
                  const { error: queueError } = await supabase
                    .from("outreach_queue")
                    .insert({
                      prospect_id: prospect.id,
                      to_email: biz.email,
                      subject: emailSubject,
                      body: emailBody,
                      email_type: "outreach",
                      status: "scheduled",
                    });

                  if (!queueError) {
                    const scheduledFor = new Date(Date.now() + (emailsGenerated * dripIntervalMinutes * 60 * 1000) + 60000);
                    await supabase
                      .from("scheduled_emails")
                      .insert({
                        prospect_id: prospect.id,
                        to_email: biz.email,
                        subject: emailSubject,
                        body: emailBody,
                        email_type: "outreach",
                        scheduled_for: scheduledFor.toISOString(),
                        status: "pending",
                      });

                    // Prospect stays in "new" — only promotes to "called" once an actual call is logged.


                    emailsGenerated++;
                    console.log(`📨 Scheduled drip email for ${biz.name} at ${scheduledFor.toISOString()}`);
                  }
                }
              }
            }
          } catch (err) {
            console.error("Email generation error:", err);
          }

          // Rate limit between email generations
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err) {
        console.error(`Error processing ${biz.name}:`, err);
      }
    }

    // Update agent run record
    await supabase
      .from("agent_runs")
      .update({
        businesses_found: businessesCreated,
        emails_generated: emailsGenerated,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", agentRun.id);

    console.log(`🏁 Run complete: ${businessesCreated} businesses, ${emailsGenerated} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        runId: agentRun.id,
        businessesFound: businessesCreated,
        emailsGenerated: emailsGenerated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Discover businesses error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
