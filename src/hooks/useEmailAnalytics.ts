import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, parseISO, startOfDay } from 'date-fns';

export interface DailyEmailStats {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

export interface EmailTypeStats {
  type: string;
  count: number;
}

export interface EmailAnalyticsData {
  dailyStats: DailyEmailStats[];
  emailTypeStats: EmailTypeStats[];
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    ctor: number;
    replyRate: number;
  };
}

export function useEmailAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['email-analytics', days],
    queryFn: async (): Promise<EmailAnalyticsData> => {
      const startDate = subDays(new Date(), days);

      const { data: emails, error } = await supabase
        .from('sent_emails')
        .select('sent_at, open_count, click_count, replied_at, email_type, status')
        .gte('sent_at', startDate.toISOString())
        .order('sent_at', { ascending: true })
        .limit(5000);

      if (error) throw error;

      // Group by date
      const dateMap = new Map<string, DailyEmailStats>();
      
      // Initialize all dates in range
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd');
        dateMap.set(date, { date, sent: 0, opened: 0, clicked: 0, replied: 0 });
      }

      // Group by email type
      const typeMap = new Map<string, number>();

      // Process emails
      emails?.forEach((email) => {
        const date = format(startOfDay(parseISO(email.sent_at)), 'yyyy-MM-dd');
        const stats = dateMap.get(date);
        
        if (stats) {
          stats.sent++;
          if (email.open_count > 0) stats.opened++;
          if (email.click_count > 0) stats.clicked++;
          if (email.replied_at) stats.replied++;
        }

        // Count email types
        const type = email.email_type || 'other';
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
      });

      const dailyStats = Array.from(dateMap.values());
      const emailTypeStats = Array.from(typeMap.entries()).map(([type, count]) => ({
        type: formatEmailType(type),
        count,
      }));

      // Calculate totals with standardized definitions
      const totalSent = emails?.length || 0;
      const totalDelivered = emails?.filter(e => ['delivered', 'opened', 'clicked', 'replied'].includes(e.status)).length || 0;
      const totalOpened = emails?.filter(e => e.open_count > 0).length || 0;
      const totalClicked = emails?.filter(e => e.click_count > 0).length || 0;
      const totalReplied = emails?.filter(e => e.replied_at).length || 0;

      return {
        dailyStats,
        emailTypeStats,
        totals: {
          sent: totalSent,
          delivered: totalDelivered,
          opened: totalOpened,
          clicked: totalClicked,
          replied: totalReplied,
          deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
          openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
          clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
          ctor: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0,
          replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
        },
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

function formatEmailType(type: string): string {
  const typeLabels: Record<string, string> = {
    introduction: 'Introduction',
    followup: 'Follow-up',
    quote: 'Quote',
    renewal: 'Renewal',
    metinperson: 'Met in Person',
    other: 'Other',
  };
  return typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}
