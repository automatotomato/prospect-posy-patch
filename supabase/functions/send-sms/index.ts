import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured (connect Twilio in Connectors)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { prospectId, toPhone, body: messageBody, fromPhone: fromOverride } = body || {};

    if (!toPhone || typeof toPhone !== "string") {
      return new Response(JSON.stringify({ error: "toPhone required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!messageBody || typeof messageBody !== "string" || messageBody.length === 0 || messageBody.length > 1600) {
      return new Response(JSON.stringify({ error: "body required (1-1600 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DNC check
    if (prospectId) {
      const { data: prospect } = await supabase
        .from("prospects")
        .select("do_not_contact, unsubscribed")
        .eq("id", prospectId)
        .maybeSingle();
      if (prospect?.do_not_contact || prospect?.unsubscribed) {
        return new Response(JSON.stringify({ error: "Prospect is opted out" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // From number
    let fromPhone = fromOverride;
    if (!fromPhone) {
      const { data: setting } = await supabase
        .from("agent_settings")
        .select("setting_value")
        .eq("setting_key", "twilio_from_number")
        .maybeSingle();
      fromPhone = setting?.setting_value;
      if (typeof fromPhone === "string" && fromPhone.startsWith('"')) {
        try { fromPhone = JSON.parse(fromPhone); } catch {}
      }
    }
    if (!fromPhone) {
      return new Response(JSON.stringify({ error: "No Twilio From number configured. Set it in SMS Templates settings." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize to E.164-ish (keep + and digits)
    const cleanedTo = toPhone.replace(/[^\d+]/g, "");
    const formattedTo = cleanedTo.startsWith("+") ? cleanedTo : `+1${cleanedTo}`;

    // Send via Twilio gateway
    const twilioResp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: fromPhone,
        Body: messageBody,
      }),
    });

    const twilioData = await twilioResp.json();

    if (!twilioResp.ok) {
      console.error("Twilio error:", twilioData);
      // Log failed attempt
      await supabase.from("sent_sms").insert({
        prospect_id: prospectId || null,
        to_phone: formattedTo,
        from_phone: fromPhone,
        body: messageBody,
        status: "failed",
        error_message: twilioData?.message || JSON.stringify(twilioData),
        created_by: user.id,
      });
      return new Response(JSON.stringify({ error: twilioData?.message || "Twilio send failed", details: twilioData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log success
    await supabase.from("sent_sms").insert({
      prospect_id: prospectId || null,
      to_phone: formattedTo,
      from_phone: fromPhone,
      body: messageBody,
      twilio_sid: twilioData.sid,
      status: twilioData.status || "queued",
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid, status: twilioData.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send-sms failed";
    console.error("send-sms error:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
