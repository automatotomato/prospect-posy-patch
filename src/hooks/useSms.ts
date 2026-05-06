import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  category: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SentSms {
  id: string;
  prospect_id: string | null;
  to_phone: string;
  from_phone: string | null;
  body: string;
  twilio_sid: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  delivered_at: string | null;
  created_by: string | null;
}

export function useSmsTemplates() {
  return useQuery({
    queryKey: ['sms_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_templates' as any)
        .select('*')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SmsTemplate[];
    },
  });
}

export function useUpsertSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tpl: Partial<SmsTemplate> & { name: string; body: string }) => {
      const payload: any = {
        name: tpl.name,
        body: tpl.body,
        category: tpl.category ?? null,
        is_default: tpl.is_default ?? false,
      };
      if (tpl.id) {
        const { data, error } = await supabase
          .from('sms_templates' as any)
          .update(payload)
          .eq('id', tpl.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('sms_templates' as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sms_templates'] }),
  });
}

export function useDeleteSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sms_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sms_templates'] }),
  });
}

export function useSentSmsForProspect(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['sent_sms', prospectId],
    queryFn: async () => {
      if (!prospectId) return [];
      const { data, error } = await supabase
        .from('sent_sms' as any)
        .select('*')
        .eq('prospect_id', prospectId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SentSms[];
    },
    enabled: !!prospectId,
  });
}

export function useTwilioFromNumber() {
  return useQuery({
    queryKey: ['twilio_from_number'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_settings')
        .select('setting_value')
        .eq('setting_key', 'twilio_from_number')
        .maybeSingle();
      if (error) throw error;
      const raw = data?.setting_value;
      if (typeof raw === 'string') return raw;
      return '';
    },
  });
}

export function useSetTwilioFromNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (number: string) => {
      const { data: existing } = await supabase
        .from('agent_settings')
        .select('id')
        .eq('setting_key', 'twilio_from_number')
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('agent_settings')
          .update({ setting_value: number as any })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agent_settings')
          .insert({ setting_key: 'twilio_from_number', setting_value: number as any });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['twilio_from_number'] }),
  });
}

export function renderSmsTemplate(body: string, vars: Record<string, string | undefined>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
