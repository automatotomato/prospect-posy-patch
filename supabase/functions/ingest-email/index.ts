import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    content_type: string;
  }>;
  headers?: Record<string, string>;
  message_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Shared secret authentication — the email forwarding service must send this header
  const ingestToken = req.headers.get('X-Ingest-Token');
  const expectedToken = Deno.env.get('EMAIL_INGEST_SECRET');
  if (!expectedToken || ingestToken !== expectedToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const emailData: InboundEmail = await req.json();
    
    console.log('Received inbound email:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      attachmentCount: emailData.attachments?.length || 0,
    });

    // Check if we already processed this email
    if (emailData.message_id) {
      const { data: existingLog } = await supabase
        .from('email_ingestion_log')
        .select('id')
        .eq('message_id', emailData.message_id)
        .single();

      if (existingLog) {
        console.log('Email already processed:', emailData.message_id);
        return new Response(
          JSON.stringify({ success: true, message: 'Already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Extract sender info
    const fromMatch = emailData.from.match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/);
    const senderName = fromMatch?.[1] || '';
    const senderEmail = fromMatch?.[2] || emailData.from;

    // Find image attachments
    const imageAttachments = emailData.attachments?.filter(att => 
      att.content_type.startsWith('image/')
    ) || [];

    let extractedData: Record<string, unknown> = {};
    let imageUrl: string | null = null;

    // If there are image attachments, process the first one with AI
    if (imageAttachments.length > 0) {
      const firstImage = imageAttachments[0];
      const imageBase64 = `data:${firstImage.content_type};base64,${firstImage.content}`;

      console.log('Processing image attachment:', firstImage.filename);

      // Call AI extraction (OpenAI)
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (OPENAI_API_KEY) {
        try {
          const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Extract business information from this image. Return a JSON object with:
- businessName, contactName, phone, email, website, address, vehicleCount, vehicleTypes (array), services, notes
Set null for fields you can't determine. Return only valid JSON.`
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Extract all business information from this image.' },
                    { type: 'image_url', image_url: { url: imageBase64 } }
                  ]
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            let content = aiData.choices?.[0]?.message?.content || '';
            
            // Clean and parse JSON
            if (content.includes('```')) {
              content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }
            try {
              extractedData = JSON.parse(content.trim());
              console.log('AI extracted:', extractedData);
            } catch (e) {
              console.error('Failed to parse AI response:', e);
            }
          }
        } catch (aiError) {
          console.error('AI extraction error:', aiError);
        }
      }
    }

    // Also try to extract info from email body text
    const emailBody = emailData.text || '';
    const emailNotes = emailBody.trim() ? `Email notes: ${emailBody.substring(0, 500)}` : '';

    // Get agents for auto-assignment (round-robin)
    const { data: agents } = await supabase
      .from('team_members')
      .select('id')
      .eq('role', 'agent')
      .limit(10);

    // Simple round-robin based on current count
    const { count: prospectCount } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true });
    
    const agentIndex = (prospectCount || 0) % (agents?.length || 1);
    const assignedAgentId = agents?.[agentIndex]?.id || null;

    // Create the prospect
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const businessName = (extractedData.businessName as string) || 
      emailData.subject?.replace(/^(Fwd:|Re:|Fw:)\s*/gi, '').trim() || 
      `Lead from ${senderEmail}`;

    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .insert({
        business_name: businessName,
        contact_name: (extractedData.contactName as string) || senderName || null,
        phone: (extractedData.phone as string) || null,
        email: (extractedData.email as string) || senderEmail,
        website: (extractedData.website as string) || null,
        location: (extractedData.address as string) || 'Unknown',
        vehicle_count: (extractedData.vehicleCount as number) || null,
        vehicle_types: (extractedData.vehicleTypes as string[]) || null,
        services: (extractedData.services as string) || null,
        notes: [extractedData.notes, emailNotes].filter(Boolean).join('\n\n') || null,
        status: 'new',
        source: 'email',
        assigned_to: assignedAgentId,
        next_follow_up: tomorrow.toISOString(),
        moved_to_quoting: false,
        image_url: imageUrl,
        raw_email_data: {
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          received_at: new Date().toISOString(),
          has_attachments: imageAttachments.length > 0,
        },
      })
      .select()
      .single();

    if (prospectError) {
      console.error('Failed to create prospect:', prospectError);
      throw prospectError;
    }

    console.log('Created prospect:', prospect.id);

    // Create initial task
    await supabase
      .from('prospect_tasks')
      .insert({
        prospect_id: prospect.id,
        type: 'call',
        description: 'Initial contact - lead from email',
        due_date: tomorrow.toISOString(),
        completed: false,
      });

    // Log the ingestion
    await supabase
      .from('email_ingestion_log')
      .insert({
        message_id: emailData.message_id,
        from_email: senderEmail,
        subject: emailData.subject,
        prospect_id: prospect.id,
        status: 'processed',
      });

    console.log('Email ingestion complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        prospectId: prospect.id,
        businessName: prospect.business_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in ingest-email function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log the failed ingestion
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
      const emailData = await req.clone().json();
      await supabase
        .from('email_ingestion_log')
        .insert({
          message_id: emailData.message_id,
          from_email: emailData.from || 'unknown',
          subject: emailData.subject,
          status: 'failed',
          error_message: errorMessage,
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
