import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { verifySenderDomain } from "../_shared/sender-domain.ts";
import { BRAND } from "../_shared/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  prospectId?: string;
  emailType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
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

    const { to, subject, body, from, replyTo, prospectId, emailType }: SendEmailRequest = await req.json();

    if (!to || !subject || !body) {
      console.error("Missing required fields:", { to, subject, bodyLength: body?.length });
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Sending email to: ${to}, subject: ${subject}`);

    // Check if prospect is unsubscribed or on do-not-contact list
    if (prospectId) {
      const { data: prospect } = await supabase
        .from("prospects")
        .select("unsubscribed, do_not_contact")
        .eq("id", prospectId)
        .single();
      
      if (prospect?.unsubscribed || prospect?.do_not_contact) {
        const reason = prospect?.do_not_contact ? "on do-not-contact list" : "unsubscribed";
        console.log(`Prospect ${prospectId} is ${reason}, skipping email`);
        return new Response(
          JSON.stringify({ error: `Recipient is ${reason}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(to)}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${body.split('\n').map((line: string) => line.trim() ? `<p style="margin: 0 0 16px 0;">${line}</p>` : '').join('')}
          <div style="margin: 28px 0 8px 0; text-align: center;">
            <a href="${BRAND.bookingUrl.replace(/&/g, '&amp;')}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Book a 15-min call
            </a>
            <div style="font-size: 11px; color: #666; margin-top: 8px;">
              Or reply to this email · <a href="tel:${BRAND.phone.replace(/[^0-9+]/g, '')}" style="color:#0f766e; text-decoration:none;">${BRAND.phone}</a>
            </div>
          </div>
          <p style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center;">
            <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a> from future emails
          </p>
        </body>
      </html>
    `;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the sender domain is verified in Resend before attempting to send.
    // This prevents wasted API calls and gives a clear, actionable error.
    const senderStatus = await verifySenderDomain();
    if (!senderStatus.ok) {
      console.error("Sender domain not verified:", senderStatus);
      return new Response(
        JSON.stringify({
          error: senderStatus.message,
          code: "sender_domain_not_verified",
          senderStatus,
        }),
        { status: 412, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from || "Z & C Consultants <management@z-cconsultants.com>",
        to: [to],
        subject: subject,
        html: htmlBody,
        reply_to: replyTo || "management@z-cconsultants.com",
      }),
    });

    const responseData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", responseData);
      return new Response(
        JSON.stringify({ error: responseData.message || "Failed to send email" }),
        { status: emailResponse.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", responseData);

    // Store sent email for tracking
    const resendId = responseData.id;
    if (resendId) {
      const { error: insertError } = await supabase.from("sent_emails").insert({
        resend_id: resendId,
        to_email: to,
        subject: subject,
        body: body,
        email_type: emailType || "outreach",
        prospect_id: prospectId || null,
        status: "sent",
      });

      if (insertError) {
        console.error("Error storing sent email:", insertError);
      } else {
        console.log("Stored sent email for tracking:", resendId);
      }

      // Prospect stays in "new" until called. Email send no longer auto-promotes status.
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: responseData,
        message: `Email sent to ${to}`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
