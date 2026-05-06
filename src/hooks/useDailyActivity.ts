import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const DAILY_CALL_GOAL = 50;

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Calls logged today (toward the 50/day goal). */
export function useTodayCallStats() {
  return useQuery({
    queryKey: ['today_call_stats'],
    queryFn: async () => {
      const { start, end } = todayBounds();
      const { data, error } = await supabase
        .from('call_logs')
        .select('id, outcome, prospect_id, called_at')
        .gte('called_at', start.toISOString())
        .lte('called_at', end.toISOString());
      if (error) throw error;
      const calls = data || [];
      const connected = calls.filter((c: any) =>
        ['spoke_with_contact', 'spoke_with_gatekeeper', 'meeting_booked', 'demo_scheduled', 'callback_requested'].includes(c.outcome)
      ).length;
      const meetings = calls.filter((c: any) => ['meeting_booked', 'demo_scheduled'].includes(c.outcome)).length;
      const uniqueProspects = new Set(calls.map((c: any) => c.prospect_id)).size;
      return {
        total: calls.length,
        connected,
        meetings,
        uniqueProspects,
        goal: DAILY_CALL_GOAL,
        remaining: Math.max(0, DAILY_CALL_GOAL - calls.length),
        percent: Math.min(100, Math.round((calls.length / DAILY_CALL_GOAL) * 100)),
      };
    },
    refetchInterval: 30000,
  });
}

/** New prospects (never called) ranked by score — fuel for the cold-call goal. */
export function useNewCallTargets(limit = 25) {
  return useQuery({
    queryKey: ['daily_new_call_targets', limit],
    queryFn: async () => {
      // Pull never-contacted, with a phone number, ranked by score.
      const { data, error } = await supabase
        .from('prospects')
        .select('id, business_name, contact_name, phone, email, lead_score, status, industry, location, created_at')
        .eq('do_not_contact', false)
        .eq('unsubscribed', false)
        .not('phone', 'is', null)
        .in('status', ['new'])
        .order('lead_score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });
}

/**
 * Previously-contacted prospects to re-engage today.
 * Filters to those NOT called in the last 3 days, prioritising replies + high score.
 */
export function usePreviousCallTargets(limit = 25) {
  return useQuery({
    queryKey: ['daily_previous_call_targets', limit],
    queryFn: async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // Prospects who have been contacted/responded but no recent call.
      const { data: prospects, error } = await supabase
        .from('prospects')
        .select('id, business_name, contact_name, phone, email, lead_score, status, industry, next_follow_up')
        .eq('do_not_contact', false)
        .eq('unsubscribed', false)
        .not('phone', 'is', null)
        .in('status', ['called', 'contacted', 'responded', 'qualified'])
        .order('lead_score', { ascending: false })
        .limit(limit * 3);
      if (error) throw error;
      if (!prospects?.length) return [];

      // Find prospects called recently and exclude them.
      const ids = prospects.map((p: any) => p.id);
      const { data: recent } = await supabase
        .from('call_logs')
        .select('prospect_id, called_at')
        .in('prospect_id', ids)
        .gte('called_at', threeDaysAgo.toISOString());
      const recentIds = new Set((recent || []).map((r: any) => r.prospect_id));

      return prospects.filter((p: any) => !recentIds.has(p.id)).slice(0, limit);
    },
    refetchInterval: 60000,
  });
}
