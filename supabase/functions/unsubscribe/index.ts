import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get email from query params (for GET requests from email links)
    const url = new URL(req.url);
    let email = url.searchParams.get("email");
    let prospectId = url.searchParams.get("id");

    // Also support POST requests
    if (req.method === "POST") {
      const body = await req.json();
      email = body.email || email;
      prospectId = body.prospectId || prospectId;
    }

    if (!email && !prospectId) {
      return new Response(
        generateHtmlPage("Error", "Missing email or prospect ID.", false),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    console.log(`Unsubscribe request for: ${email || prospectId}`);

    // Find and update the prospect
    let query = supabase.from("prospects").update({
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
    });

    if (prospectId) {
      query = query.eq("id", prospectId);
    } else if (email) {
      query = query.eq("email", email);
    }

    const { data, error } = await query.select("business_name, email");

    if (error) {
      console.error("Unsubscribe error:", error);
      return new Response(
        generateHtmlPage("Error", "Something went wrong. Please try again.", false),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    if (!data || data.length === 0) {
      return new Response(
        generateHtmlPage("Not Found", "Email address not found in our system.", false),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    console.log(`Successfully unsubscribed: ${data[0].email}`);

    return new Response(
      generateHtmlPage(
        "Unsubscribed",
        `You have been successfully unsubscribed from Automate Planet emails. You will no longer receive marketing communications from us.`,
        true
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  } catch (error: unknown) {
    console.error("Unsubscribe error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      generateHtmlPage("Error", message, false),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  }
});

function generateHtmlPage(title: string, message: string, success: boolean): string {
  const iconColor = success ? "#22c55e" : "#ef4444";
  const icon = success
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Automate Planet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .icon { margin-bottom: 24px; }
    h1 {
      color: #1a1a2e;
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      color: #64748b;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .logo {
      color: #64748b;
      font-size: 14px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }
    .logo strong { color: #1a1a2e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="logo">
      <strong>Automate Planet</strong><br>
      (702) 863-3200
    </div>
  </div>
</body>
</html>
  `;
}
