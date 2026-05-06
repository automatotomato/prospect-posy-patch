import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Twilio sends application/x-www-form-urlencoded
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid")?.toString();
    const messageStatus = formData.get("MessageStatus")?.toString();
    const errorMessage = formData.get("ErrorMessage")?.toString();

    if (!messageSid) {
      return new Response("Missing MessageSid", { status: 400, headers: corsHeaders });
    }

    const updates: Record<string, unknown> = {
      status: messageStatus || "unknown",
    };
    if (errorMessage) updates.error_message = errorMessage;
    if (messageStatus === "delivered") updates.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from("sent_sms")
      .update(updates)
      .eq("twilio_sid", messageSid);

    if (error) console.error("Webhook update error:", error);

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("twilio-webhook error:", err);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
