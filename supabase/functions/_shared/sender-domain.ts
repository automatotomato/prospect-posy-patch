// Shared helper: verify the sender domain is verified in Resend before sending.
// Caches result in-memory for 5 minutes to avoid hammering Resend's /domains endpoint.

export const SENDER_EMAIL = "marketing@automateplanet.com";
export const SENDER_DOMAIN = "automateplanet.com";

export interface SenderDomainStatus {
  ok: boolean;            // true only when the domain is verified and ready to send
  verified: boolean;      // true if Resend reports status === "verified"
  status: string;         // raw Resend status: verified | pending | failed | not_started | not_found | unknown
  domain: string;
  senderEmail: string;
  message: string;        // human-readable explanation
  checkedAt: string;      // ISO timestamp
  error?: string;         // populated on hard errors (bad API key, network, etc.)
}

interface CacheEntry { value: SenderDomainStatus; expiresAt: number; }
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function verifySenderDomain(domain: string = SENDER_DOMAIN, opts: { force?: boolean } = {}): Promise<SenderDomainStatus> {
  const now = Date.now();
  if (!opts.force) {
    const cached = cache.get(domain);
    if (cached && cached.expiresAt > now) return cached.value;
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    const result: SenderDomainStatus = {
      ok: false,
      verified: false,
      status: "unknown",
      domain,
      senderEmail: SENDER_EMAIL,
      message: "RESEND_API_KEY is not configured. Add it in Cloud → Secrets.",
      checkedAt: new Date(now).toISOString(),
      error: "missing_api_key",
    };
    return result;
  }

  try {
    const resp = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      const result: SenderDomainStatus = {
        ok: false,
        verified: false,
        status: "unknown",
        domain,
        senderEmail: SENDER_EMAIL,
        message: `Could not verify sender domain with Resend (HTTP ${resp.status}). ${text.slice(0, 200)}`,
        checkedAt: new Date(now).toISOString(),
        error: `resend_${resp.status}`,
      };
      // Don't cache hard failures for long
      cache.set(domain, { value: result, expiresAt: now + 30_000 });
      return result;
    }

    const data = await resp.json();
    const list: Array<{ name: string; status: string }> = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const match = list.find((d) => d?.name?.toLowerCase() === domain.toLowerCase());

    let result: SenderDomainStatus;
    if (!match) {
      result = {
        ok: false,
        verified: false,
        status: "not_found",
        domain,
        senderEmail: SENDER_EMAIL,
        message: `Domain "${domain}" is not added in Resend. Add it at https://resend.com/domains and verify the DNS records (SPF, DKIM, DMARC) before sending from ${SENDER_EMAIL}.`,
        checkedAt: new Date(now).toISOString(),
      };
    } else if (match.status === "verified") {
      result = {
        ok: true,
        verified: true,
        status: "verified",
        domain,
        senderEmail: SENDER_EMAIL,
        message: `Domain "${domain}" is verified — ${SENDER_EMAIL} is ready to send.`,
        checkedAt: new Date(now).toISOString(),
      };
    } else {
      result = {
        ok: false,
        verified: false,
        status: match.status || "unknown",
        domain,
        senderEmail: SENDER_EMAIL,
        message: `Domain "${domain}" status in Resend is "${match.status}". Finish DNS verification at https://resend.com/domains before sending from ${SENDER_EMAIL}.`,
        checkedAt: new Date(now).toISOString(),
      };
    }

    cache.set(domain, { value: result, expiresAt: now + CACHE_TTL_MS });
    return result;
  } catch (e) {
    const result: SenderDomainStatus = {
      ok: false,
      verified: false,
      status: "unknown",
      domain,
      senderEmail: SENDER_EMAIL,
      message: `Failed to reach Resend to verify the sender domain: ${e instanceof Error ? e.message : String(e)}`,
      checkedAt: new Date(now).toISOString(),
      error: "network",
    };
    cache.set(domain, { value: result, expiresAt: now + 30_000 });
    return result;
  }
}

export function clearSenderDomainCache() {
  cache.clear();
}
