import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProspectEmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  lastSentAt: string | null;
  lastOpenedAt: string | null;
  openRate: number;
  clickRate: number;
}

export function useProspectEmailStats(prospectId?: string | null) {
  return useQuery({
    queryKey: ['prospect_email_stats', prospectId],
    enabled: !!prospectId,
    queryFn: async (): Promise<ProspectEmailStats> => {
      const { data, error } = await supabase
        .from('sent_emails')
        .select('status, open_count, click_count, replied_at, opened_at, sent_at')
        .eq('prospect_id', prospectId!);
      if (error) throw error;
      const rows = data || [];
      const sent = rows.length;
      const delivered = rows.filter((e: any) => ['delivered', 'opened', 'clicked', 'replied'].includes(e.status)).length;
      const opened = rows.filter((e: any) => (e.open_count ?? 0) > 0 || e.opened_at).length;
      const clicked = rows.filter((e: any) => (e.click_count ?? 0) > 0).length;
      const replied = rows.filter((e: any) => e.status === 'replied' || e.replied_at).length;
      const bounced = rows.filter((e: any) => ['bounced', 'failed'].includes(e.status)).length;
      const sortedSent = rows
        .map((r: any) => r.sent_at)
        .filter(Boolean)
        .sort()
        .reverse();
      const sortedOpened = rows
        .map((r: any) => r.opened_at)
        .filter(Boolean)
        .sort()
        .reverse();
      return {
        sent,
        delivered,
        opened,
        clicked,
        replied,
        bounced,
        lastSentAt: sortedSent[0] || null,
        lastOpenedAt: sortedOpened[0] || null,
        openRate: sent ? Math.round((opened / sent) * 100) : 0,
        clickRate: sent ? Math.round((clicked / sent) * 100) : 0,
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
