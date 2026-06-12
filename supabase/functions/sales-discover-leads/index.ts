import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const EXCLUDED = [
  "health", "hospital", "clinic", "dental", "medical", "pharma", "pharmacy",
  "insurance", "insurer", "wellness", "chiropract", "physician", "doctor",
  "veterinary", "nursing", "rehab", "therapy", "cosmetic", "dermatol",
];

function isExcluded(text: string) {
  const t = (text || "").toLowerCase();
  return EXCLUDED.some((kw) => t.includes(kw));
}

const DEFAULT_VERTICALS = [
  "manufacturing", "warehouse", "logistics company", "transportation company",
  "freight broker", "distribution center", "wholesale supplier", "3PL",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const vertical: string = body.vertical || DEFAULT_VERTICALS[Math.floor(Math.random() * DEFAULT_VERTICALS.length)];
    const city: string = body.city || "Las Vegas, NV";
    const count: number = Math.min(Math.max(Number(body.count) || 10, 1), 20);

    // Load user-defined excluded verticals from settings
    const adminEarly = createClient(url, serviceKey);
    const { data: discRow } = await adminEarly.from("agent_settings").select("setting_value").eq("setting_key", "discovery").maybeSingle();
    const userExcluded: string[] = ((discRow?.setting_value as any)?.excludedVerticals || []).map((s: string) => String(s).toLowerCase());
    const allExcluded = [...EXCLUDED, ...userExcluded];
    const isBlocked = (text: string) => {
      const t = (text || "").toLowerCase();
      return allExcluded.some((kw) => kw && t.includes(kw));
    };
    if (isBlocked(vertical)) {
      return new Response(JSON.stringify({ inserted: 0, skipped: "vertical excluded", vertical }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!googleKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google Places Text Search
    const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.types,places.id",
      },
      body: JSON.stringify({ textQuery: `${vertical} in ${city}`, pageSize: count }),
    });
    const placesJson = await placesRes.json();
    if (!placesRes.ok) {
      return new Response(JSON.stringify({ error: "Places error", details: placesJson }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const places = (placesJson.places || []) as any[];
    const admin = createClient(url, serviceKey);
    const inserted: any[] = [];

    for (const p of places) {
      const name = p.displayName?.text || "Unknown";
      const types = (p.types || []).join(" ");
      if (isExcluded(name) || isExcluded(types) || isExcluded(vertical)) continue;

      const website = p.websiteUri || null;
      const phone = p.nationalPhoneNumber || null;
      const address = p.formattedAddress || "";
      const addrParts = address.split(",").map((s: string) => s.trim());
      const stateZip = addrParts[addrParts.length - 2] || "";
      const stateAbbr = stateZip.split(" ")[0] || null;
      const cityPart = addrParts[addrParts.length - 3] || city;

      // dedupe by business_name + owner
      const { data: existing } = await admin
        .from("sales_leads")
        .select("id")
        .eq("owner_id", userId)
        .eq("business_name", name)
        .maybeSingle();
      if (existing) continue;

      const { data, error } = await admin.from("sales_leads").insert({
        owner_id: userId,
        business_name: name,
        website,
        phone,
        city: cityPart,
        state: stateAbbr,
        industry: vertical,
        source: "google_places",
        status: "new",
      }).select().single();
      if (!error && data) inserted.push(data);
    }

    return new Response(JSON.stringify({ inserted: inserted.length, leads: inserted, vertical, city }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
