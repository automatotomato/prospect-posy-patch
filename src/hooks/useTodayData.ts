import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HotLead {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_score: number;
  status: string;
  industry: string | null;
  next_follow_up: string | null;
}

export function useHotLeads(limit = 10) {
  return useQuery({
    queryKey: ['today_hot_leads', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospects')
        .select('id, business_name, contact_name, email, phone, lead_score, status, industry, next_follow_up')
        .eq('do_not_contact', false)
        .eq('unsubscribed', false)
        .not('status', 'in', '(closed)')
        .order('lead_score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as HotLead[];
    },
    refetchInterval: 60000,
  });
}

export function useFollowUpsDue() {
  return useQuery({
    queryKey: ['today_followups_due'],
    queryFn: async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('prospects')
        .select('id, business_name, contact_name, email, phone, lead_score, status, next_follow_up')
        .eq('do_not_contact', false)
        .not('next_follow_up', 'is', null)
        .lt('next_follow_up', tomorrow.toISOString())
        .not('status', 'in', '(closed)')
        .order('next_follow_up', { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });
}

export function useTodayDemos() {
  return useQuery({
    queryKey: ['today_demos'],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('conversions')
        .select('id, type, scheduled_for, notes, prospect_id, prospects:prospect_id(business_name, contact_name, phone, email, lead_score)')
        .gte('scheduled_for', start.toISOString())
        .lte('scheduled_for', end.toISOString())
        .order('scheduled_for', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });
}
