import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CallLog {
  id: string;
  prospect_id: string;
  called_at: string;
  duration_seconds: number | null;
  outcome: string;
  notes: string | null;
  contact_reached: string | null;
  follow_up_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Conversion {
  id: string;
  prospect_id: string;
  type: string;
  scheduled_for: string | null;
  value: number | null;
  notes: string | null;
  created_at: string;
}

export interface CallLogWithProspect extends CallLog {
  prospects: {
    id: string;
    business_name: string;
    phone: string | null;
    email: string | null;
    status: string;
  } | null;
}

export function useCallLogs(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['call_logs', prospectId],
    queryFn: async () => {
      if (!prospectId) return [];
      const { data, error } = await supabase
        .from('call_logs' as any)
        .select('*')
        .eq('prospect_id', prospectId)
        .order('called_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CallLog[];
    },
    enabled: !!prospectId,
  });
}

export function useAddCallLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (log: Omit<CallLog, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('call_logs' as any)
        .insert(log as any)
        .select()
        .single();
      if (error) throw error;

      // Auto-promote prospect from "new" to "called" once they've been dialed.
      if (log.prospect_id) {
        await supabase
          .from('prospects')
          .update({ status: 'called' as any })
          .eq('id', log.prospect_id)
          .eq('status', 'new');
      }

      return data as unknown as CallLog;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['call_logs', variables.prospect_id] });
      queryClient.invalidateQueries({ queryKey: ['call_logs_count'] });
      queryClient.invalidateQueries({ queryKey: ['all_call_logs'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming_follow_ups'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

export function useConversions(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['conversions', prospectId],
    queryFn: async () => {
      if (!prospectId) return [];
      const { data, error } = await supabase
        .from('conversions' as any)
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Conversion[];
    },
    enabled: !!prospectId,
  });
}

export function useAddConversion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversion: Omit<Conversion, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('conversions' as any)
        .insert(conversion as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Conversion;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversions', variables.prospect_id] });
      queryClient.invalidateQueries({ queryKey: ['conversions_count'] });
    },
  });
}

export function useCallLogsCount(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['call_logs_count', prospectId],
    queryFn: async () => {
      if (!prospectId) return 0;
      const { count, error } = await supabase
        .from('call_logs' as any)
        .select('*', { count: 'exact', head: true })
        .eq('prospect_id', prospectId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!prospectId,
  });
}

export function useLatestConversion(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['latest_conversion', prospectId],
    queryFn: async () => {
      if (!prospectId) return null;
      const { data, error } = await supabase
        .from('conversions' as any)
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Conversion | null;
    },
    enabled: !!prospectId,
  });
}

export function useAllCallLogs() {
  return useQuery({
    queryKey: ['all_call_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs' as any)
        .select('*, prospects(id, business_name, phone, email, status)')
        .order('called_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CallLogWithProspect[];
    },
  });
}

export function useUpcomingFollowUps() {
  return useQuery({
    queryKey: ['upcoming_follow_ups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs' as any)
        .select('*, prospects(id, business_name, phone, email, status)')
        .not('follow_up_date', 'is', null)
        .order('follow_up_date', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CallLogWithProspect[];
    },
  });
}
