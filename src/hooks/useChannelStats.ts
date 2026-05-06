import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function useTodayEmailStats() {
  return useQuery({
    queryKey: ['today_email_stats'],
    queryFn: async () => {
      const { start, end } = todayBounds();
      const { count, error } = await supabase
        .from('sent_emails')
        .select('id', { count: 'exact', head: true })
        .gte('sent_at', start.toISOString())
        .lte('sent_at', end.toISOString());
      if (error) throw error;
      return { total: count || 0 };
    },
    refetchInterval: 30000,
  });
}

export function useTodaySmsStats() {
  return useQuery({
    queryKey: ['today_sms_stats'],
    queryFn: async () => {
      const { start, end } = todayBounds();
      const { count, error } = await supabase
        .from('sent_sms' as any)
        .select('id', { count: 'exact', head: true })
        .gte('sent_at', start.toISOString())
        .lte('sent_at', end.toISOString());
      if (error) throw error;
      return { total: count || 0 };
    },
    refetchInterval: 30000,
  });
}
