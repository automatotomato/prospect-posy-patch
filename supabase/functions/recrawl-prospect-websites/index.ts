import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JUNK_EMAIL_DOMAINS = /(sentry\.io|wixpress\.com|godaddy\.com|squarespace\.com|example\.com|domain\.com|yourdomain|test\.com|email\.com|sample\.com|mhtml\.blink|sentry-next\.wixpress\.com|wix\.com|cloudflare\.com|cdn\.|googletagmanager\.com|google-analytics\.com|facebook\.com|fbcdn|gstatic\.com|w3\.org|schema\.org)/i;
const JUNK_LOCAL_PARTS = /(noreply|no-reply|donotreply|do-not-reply|postmaster|mailer-daemon|abuse|^frame-|^cid:|^image\d|^logo\d|^icon|^bg-)/i;
// Reject anything that looks like an embedded resource ID or HTML artifact, not a real email
const JUNK_FULL_EMAIL = /^(frame-|cid:|image|logo|icon|bg-|sprite-|widget-|asset-)/i;
const MAX_PROSPECTS_PER_INVOCATION = 3;
const FUNCTION_TIME_BUDGET_MS = 105_000;
const FIRECRAWL_TIMEOUT_MS = 8_000;
const OPENAI_TIMEOUT_MS = 10_000;

function extractDomain(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function rankEmail(email: string, businessDomain: string | null): number {
  const lower = email.toLowerCase();
  if (JUNK_EMAIL_DOMAINS.test(lower) || JUNK_LOCAL_PARTS.test(lower) || JUNK_FULL_EMAIL.test(lower)) return -1;
  const [local, domain] = lower.split("@");
  if (!local || !domain) return -1;
  // Reject domains with no TLD or suspicious TLDs (mhtml, blink, internal)
  if (!/\.[a-z]{2,}$/i.test(domain)) return -1;
  if (/(blink|mhtml|local|internal|invalid|localhost)$/i.test(domain)) return -1;
  // Reject local parts containing hex hashes (e.g., frame-6cc6f097...)
  if (/[a-f0-9]{16,}/i.test(local)) return -1;
  let score = 0;
  if (businessDomain && (domain === businessDomain || domain.endsWith("." + businessDomain) || businessDomain.endsWith("." + domain))) score += 100;
  if (/^(owner|founder|ceo|president|gm|manager|director|admin|principal)$/.test(local)) score += 40;
  if (/^[a-z]+(\.[a-z]+)?$/.test(local) && local.length <= 20 && !/^(info|sales|contact|support|hello|office|admin|service|hr|careers|jobs|billing|accounts)$/.test(local)) score += 30;
  if (/^(careers|hr|recruiting|jobs|hiring|talent|people)$/.test(local)) score += 20;
  if (/^(sales|partnerships|appointments|scheduling|bookings|service|office)$/.test(local)) score += 15;
  if (/^(info|contact|hello|hi|inquiries|admin|reception)$/.test(local)) score += 5;
  if (/^(support|help|billing|accounts|noreply|no-reply)$/.test(local)) score -= 10;
  return score;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapeSite(website: string, apiKey: string, deadline: number): Promise<{ emails: string[]; markdown: string }> {
  const candidatePaths = ["", "/contact", "/about"];
  const found = new Set<string>();
  let combinedMarkdown = "";

  for (const path of candidatePaths) {
    if (Date.now() > deadline - 20_000) break;
    let target: string;
    try {
      const u = new URL(website);
      target = `${u.origin}${path || u.pathname}`;
    } catch {
      target = website + path;
    }
    try {
      console.log(`Firecrawl scrape start: ${target}`);
      const resp = await fetchWithTimeout("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, formats: ["markdown", "html", "links"], onlyMainContent: false, waitFor: 800, location: { country: "US", languages: ["en"] } }),
      }, FIRECRAWL_TIMEOUT_MS);
      if (!resp.ok) {
        console.warn(`Firecrawl scrape failed for ${target}: ${resp.status} ${await resp.text().catch(() => "")}`);
        if (resp.status === 402) return { emails: [...found], markdown: combinedMarkdown };
        continue;
      }
      const data = await resp.json();
      const doc = data.data || data;
      if (doc.markdown) combinedMarkdown += `\n\n--- ${path || "/"} ---\n${doc.markdown}`;
      const haystacks: string[] = [doc.markdown || "", doc.html || "", ...(Array.isArray(doc.links) ? doc.links : [])];
      for (const text of haystacks) {
        if (!text) continue;
        for (const m of String(text).matchAll(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)) found.add(m[1].toLowerCase());
        for (const e of String(text).match(EMAIL_REGEX) || []) found.add(e.toLowerCase());
      }
      if (combinedMarkdown.length > 14000) break;
    } catch (e) {
      console.warn(`Scrape failed for ${target}:`, e instanceof Error ? e.message : e);
    }
  }

  return { emails: [...found], markdown: combinedMarkdown.slice(0, 12000) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!FIRECRAWL_KEY || !OPENAI_KEY) {
      return new Response(JSON.stringify({ error: "Missing FIRECRAWL_API_KEY or OPENAI_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedLimit = Number(body.limit) || MAX_PROSPECTS_PER_INVOCATION;
    const limit: number = Math.min(Math.max(requestedLimit, 1), MAX_PROSPECTS_PER_INVOCATION);
    const onlyBounced: boolean = body.onlyBounced === true;
    const prospectIds: string[] | undefined = Array.isArray(body.prospectIds) ? body.prospectIds : undefined;
    const startedAt = Date.now();
    const deadline = startedAt + FUNCTION_TIME_BUDGET_MS;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Build query: prospects with a website, not unsubscribed/DNC
    let query = supabase
      .from("prospects")
      .select("id, business_name, website, email, contact_name")
      .not("website", "is", null)
      .eq("do_not_contact", false)
      .eq("unsubscribed", false)
      .order("email_recrawled_at", { ascending: true, nullsFirst: true })
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (prospectIds && prospectIds.length > 0) {
      query = query.in("id", prospectIds);
    }

    const { data: prospects, error: fetchErr } = await query;
    if (fetchErr) {
      console.error("Fetch prospects error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = {
      processed: 0,
      updated: 0,
      noChange: 0,
      noEmailFound: 0,
      errors: 0,
      requestedLimit,
      batchLimit: limit,
      reachedTimeBudget: false,
      details: [] as Array<Record<string, unknown>>,
    };

    for (const p of prospects || []) {
      if (Date.now() > deadline - 25_000) {
        summary.reachedTimeBudget = true;
        break;
      }
      summary.processed++;
      try {
        const website = p.website as string;
        const businessDomain = extractDomain(website);
        const { emails, markdown } = await scrapeSite(website, FIRECRAWL_KEY, deadline);

        // Rank scraped emails
        const ranked = emails
          .map(e => ({ email: e, score: rankEmail(e, businessDomain) }))
          .filter(x => x.score >= 0)
          .sort((a, b) => b.score - a.score);

        let bestEmail: string | null = ranked.length > 0 ? ranked[0].email : null;
        let contactName: string | null = null;
        let contactRole: string | null = null;
        let source = "firecrawl";

        // OpenAI: pick the BEST decision-maker email + extract contact
        if (markdown.trim().length > 50 && Date.now() < deadline - 15_000) {
          try {
            const oResp = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                max_completion_tokens: 400,
                messages: [
                  { role: "system", content: "You extract decision-maker contact info from scraped business website text. Never invent emails — only return one if it appears in the text or can be constructed from a person's full name plus the confirmed company domain. Return only valid JSON." },
                  { role: "user", content: `Business: ${p.business_name}\nDomain: ${businessDomain || "unknown"}\nEmails detected on the pages: ${emails.join(", ") || "none"}\n\nSCRAPED CONTENT (truncated):\n${markdown}\n\nReturn JSON: {"email": "best decision-maker email or null", "contactName": "owner/manager name or null", "contactRole": "title or null"}` },
                ],
              }),
            }, OPENAI_TIMEOUT_MS);
            if (oResp.ok) {
              const oData = await oResp.json();
              const parsed = JSON.parse(oData.choices?.[0]?.message?.content || "{}");
              if (parsed.email && /@/.test(parsed.email) && parsed.email !== "null") {
                const proposed = String(parsed.email).toLowerCase();
                const proposedScore = rankEmail(proposed, businessDomain);
                const currentBestScore = bestEmail ? rankEmail(bestEmail, businessDomain) : -1;
                if (proposedScore > currentBestScore) {
                  bestEmail = proposed;
                  source = "openai";
                }
              }
              if (parsed.contactName && parsed.contactName !== "null") contactName = parsed.contactName;
              if (parsed.contactRole && parsed.contactRole !== "null") contactRole = parsed.contactRole;
            }
          } catch (e) {
            console.warn(`OpenAI extraction failed for ${p.business_name}:`, e instanceof Error ? e.message : e);
          }
        }

        if (!bestEmail) {
          await supabase
            .from("prospects")
            .update({
              email_recrawled_at: new Date().toISOString(),
              email_recrawl_status: "no_email_found",
              email_recrawl_error: null,
            })
            .eq("id", p.id);
          summary.noEmailFound++;
          summary.details.push({ id: p.id, business: p.business_name, status: "no_email_found" });
          continue;
        }

        const emailChanged = bestEmail.toLowerCase() !== (p.email || "").toLowerCase();
        const updates: Record<string, unknown> = {
          email_recrawled_at: new Date().toISOString(),
          email_recrawl_status: emailChanged ? "updated" : "no_change",
          email_recrawl_error: null,
          email_source: source,
        };
        if (emailChanged) updates.email = bestEmail;
        if (contactName && !p.contact_name) updates.contact_name = contactName;

        if (!emailChanged && !contactName) {
          await supabase
            .from("prospects")
            .update(updates)
            .eq("id", p.id);
          summary.noChange++;
          summary.details.push({ id: p.id, business: p.business_name, status: "no_change", email: bestEmail });
          continue;
        }

        const { error: updErr } = await supabase
          .from("prospects")
          .update(updates)
          .eq("id", p.id);
        if (updErr) {
          summary.errors++;
          summary.details.push({ id: p.id, business: p.business_name, status: "error", error: updErr.message });
          continue;
        }

        summary.updated++;
        summary.details.push({
          id: p.id,
          business: p.business_name,
          status: "updated",
          oldEmail: p.email,
          newEmail: bestEmail,
          contactName: contactName || p.contact_name,
          contactRole,
          source,
        });
        console.log(`✅ Recrawled ${p.business_name}: ${p.email || "none"} → ${bestEmail} (${source})`);

        // Pace to avoid Firecrawl/OpenAI bursts
        await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        summary.errors++;
        console.error(`Error recrawling ${p.business_name}:`, e);
        const message = e instanceof Error ? e.message : String(e);
        await supabase
          .from("prospects")
          .update({
            email_recrawled_at: new Date().toISOString(),
            email_recrawl_status: "error",
            email_recrawl_error: message.slice(0, 500),
          })
          .eq("id", p.id);
        summary.details.push({ id: p.id, business: p.business_name, status: "error", error: message });
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Recrawl error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Recrawl failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
