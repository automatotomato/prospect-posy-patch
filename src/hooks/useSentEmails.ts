import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SentEmail {
  id: string;
  to_email: string;
  subject: string;
  body: string | null;
  sent_at: string;
  open_count: number;
  click_count: number;
  opened_at: string | null;
  clicked_at: string | null;
  status: string;
  replied_at: string | null;
  email_type: string | null;
  prospect_id: string | null;
  reply_text?: string | null;
  prospects?: {
    business_name: string;
    location: string;
  } | null;
}

export function useSentEmails() {
  return useQuery({
    queryKey: ['sent-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sent_emails')
        .select('*, prospects(business_name, location)')
        .order('sent_at', { ascending: false });

      if (error) throw error;
      const emails = data as SentEmail[];

      // Fetch reply text for replied emails
      const repliedIds = emails.filter(e => e.status === 'replied' || e.replied_at).map(e => e.id);
      if (repliedIds.length > 0) {
        const { data: events } = await supabase
          .from('email_events')
          .select('sent_email_id, event_data')
          .eq('event_type', 'email.replied')
          .in('sent_email_id', repliedIds);

        if (events) {
          const replyMap = new Map<string, string>();
          for (const ev of events) {
            const replyText = (ev.event_data as any)?.reply?.text;
            if (replyText && ev.sent_email_id) {
              replyMap.set(ev.sent_email_id, replyText);
            }
          }
          for (const email of emails) {
            email.reply_text = replyMap.get(email.id) || null;
          }
        }
      }

      return emails;
    },
    refetchInterval: 30000,
  });
}

export function useSentEmailStats() {
  return useQuery({
    queryKey: ['sent-email-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sent_emails')
        .select('open_count, click_count, status');

      if (error) throw error;

      const total = data?.length || 0;
      const opened = data?.filter(e => e.open_count > 0).length || 0;
      const clicked = data?.filter(e => e.click_count > 0).length || 0;
      const delivered = data?.filter(e => ['delivered', 'opened', 'clicked', 'replied'].includes(e.status)).length || 0;
      const replied = data?.filter(e => e.status === 'replied').length || 0;

      return {
        total,
        opened,
        clicked,
        delivered,
        replied,
        openRate: total > 0 ? Math.round((opened / total) * 100) : 0,
        clickRate: total > 0 ? Math.round((clicked / total) * 100) : 0,
        ctor: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
        deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
      };
    },
  });
}
