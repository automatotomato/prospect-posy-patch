import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse optional params
  let forceAll = false;
  let batchSize = 50;
  let maxBatches = 20;
  try {
    const body = await req.json();
    if (body.forceAll) forceAll = true;
    if (body.batchSize && body.batchSize > 0 && body.batchSize <= 100) batchSize = body.batchSize;
    if (body.maxBatches && body.maxBatches > 0 && body.maxBatches <= 100) maxBatches = body.maxBatches;
  } catch { /* no body is fine */ }

  try {
    let totalScanned = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    let totalFailed = 0;
    let batchesRun = 0;
    let hasMore = true;

    while (hasMore && batchesRun < maxBatches) {
      // Build query — if forceAll, scan everything with a resend_id; otherwise only sent/delivered
      let query = supabase
        .from("sent_emails")
        .select("id, resend_id, status, open_count, click_count")
        .not("resend_id", "is", null)
        .order("sent_at", { ascending: true })
        .range(batchesRun * batchSize, (batchesRun + 1) * batchSize - 1);

      if (!forceAll) {
        query = query.in("status", ["sent", "delivered"]);
      }

      const { data: emails, error } = await query;
      if (error) throw error;

      if (!emails || emails.length === 0) {
        hasMore = false;
        break;
      }

      for (const email of emails) {
        totalScanned++;
        try {
          const response = await fetch(`https://api.resend.com/emails/${email.resend_id}`, {
            headers: { Authorization: `Bearer ${resendApiKey}` },
          });

          if (!response.ok) {
            console.error(`Resend API error for ${email.resend_id}: ${response.status}`);
            totalFailed++;
            continue;
          }

          const resendData = await response.json();
          const updates: Record<string, unknown> = {};

          // Map last_event to status
          if (resendData.last_event) {
            const eventMap: Record<string, string> = {
              sent: "sent",
              delivered: "delivered",
              delivery_delayed: "delivered",
              opened: "opened",
              clicked: "clicked",
              bounced: "bounced",
              complained: "complained",
            };
            const mappedStatus = eventMap[resendData.last_event];
            if (mappedStatus && mappedStatus !== email.status) {
              updates.status = mappedStatus;
            }
          }

          // Process events array if available
          if (resendData.events && Array.isArray(resendData.events)) {
            const openEvents = resendData.events.filter((e: any) => e.type === "opened" || e.type === "email.opened");
            const clickEvents = resendData.events.filter((e: any) => e.type === "clicked" || e.type === "email.clicked");

            if (openEvents.length > 0) {
              updates.open_count = openEvents.length;
              updates.opened_at = openEvents[0].created_at || new Date().toISOString();
              if (!updates.status || updates.status === "delivered" || updates.status === "sent") {
                updates.status = "opened";
              }
            }
            if (clickEvents.length > 0) {
              updates.click_count = clickEvents.length;
              updates.clicked_at = clickEvents[0].created_at || new Date().toISOString();
              updates.status = "clicked";
            }
          } else {
            // Fallback: use last_event to infer counts when events array is missing
            if (resendData.last_event === "opened" && (email.open_count || 0) === 0) {
              updates.open_count = 1;
              updates.opened_at = new Date().toISOString();
            }
            if (resendData.last_event === "clicked") {
              if ((email.open_count || 0) === 0) {
                updates.open_count = 1;
                updates.opened_at = new Date().toISOString();
              }
              if ((email.click_count || 0) === 0) {
                updates.click_count = 1;
                updates.clicked_at = new Date().toISOString();
              }
            }
          }

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from("sent_emails")
              .update(updates)
              .eq("id", email.id);

            if (updateError) {
              console.error(`Error updating email ${email.id}:`, updateError);
              totalFailed++;
            } else {
              totalUpdated++;
            }
          } else {
            totalUnchanged++;
          }

          // Rate limit: 500ms delay between Resend API calls
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Error processing email ${email.resend_id}:`, err);
          totalFailed++;
        }
      }

      batchesRun++;
      if (emails.length < batchSize) {
        hasMore = false;
      }
    }

    // Check remaining count
    let remaining = 0;
    if (!forceAll) {
      const { count } = await supabase
        .from("sent_emails")
        .select("id", { count: "exact", head: true })
        .not("resend_id", "is", null)
        .in("status", ["sent", "delivered"]);
      remaining = count || 0;
    }

    return new Response(JSON.stringify({
      scanned: totalScanned,
      updated: totalUpdated,
      unchanged: totalUnchanged,
      failed: totalFailed,
      remaining,
      batchesRun,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
