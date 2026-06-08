import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { verifySenderDomain } from "../_shared/sender-domain.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Verify sender domain in Resend before processing the queue. If not verified,
    // bail out early — running the loop would just burn the rate limit on failures.
    const senderStatus = await verifySenderDomain();
    if (!senderStatus.ok) {
      console.error("Sender domain not verified, skipping scheduled email run:", senderStatus);
      return new Response(
        JSON.stringify({
          success: false,
          processed: 0,
          error: senderStatus.message,
          code: "sender_domain_not_verified",
          senderStatus,
        }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all pending emails that are due
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('No pending emails to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingEmails.length} scheduled emails`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < pendingEmails.length; i++) {
      const email = pendingEmails[i];

      // Delay between emails to respect Resend rate limit (2 req/min)
      if (i > 0) {
        console.log(`Waiting 35s before sending email ${i + 1}/${pendingEmails.length}...`);
        await new Promise((resolve) => setTimeout(resolve, 35000));
      }

      try {
        // Build HTML body
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            ${email.body.split('\n').map((line: string) => `<p style="margin: 0 0 10px 0;">${line}</p>`).join('')}
          </div>
        `;

        // Send via Resend
        const { data: resendData, error: resendError } = await resend.emails.send({
          from: 'Z & C Consultants <management@z-cconsultants.com>',
          to: [email.to_email],
          subject: email.subject,
          html: htmlBody,
          reply_to: 'management@z-cconsultants.com',
        });

        if (resendError) {
          console.error('Resend error for', email.id, resendError);
          await supabase
            .from('scheduled_emails')
            .update({ status: 'failed' })
            .eq('id', email.id);
          failed++;
          continue;
        }

        // Mark as sent
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        // Also log to sent_emails table
        await supabase
          .from('sent_emails')
          .insert({
            to_email: email.to_email,
            subject: email.subject,
            body: email.body,
            prospect_id: email.prospect_id,
            email_type: email.email_type,
            resend_id: resendData?.id || null,
            status: 'sent',
          });

        // Prospect stays in "new" until called. Email send no longer auto-promotes status.

        console.log('Sent scheduled email:', email.id);
        sent++;
      } catch (error) {
        console.error('Error processing email', email.id, error);
        await supabase
          .from('scheduled_emails')
          .update({ status: 'failed' })
          .eq('id', email.id);
        failed++;
      }
    }

    console.log(`Processed: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, processed: pendingEmails.length, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process scheduled emails';
    console.error('Process scheduled emails error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
