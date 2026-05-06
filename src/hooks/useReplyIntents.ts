import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReplyIntent {
  id: string;
  prospect_id: string | null;
  sent_email_id: string | null;
  inbound_message_id: string | null;
  inbound_body: string | null;
  intent: string;
  confidence: number | null;
  urgency: string | null;
  suggested_subject: string | null;
  suggested_body: string | null;
  status: string;
  created_at: string;
  used_at: string | null;
  prospects?: {
    id: string;
    business_name: string;
    contact_name: string | null;
    email: string | null;
    lead_score: number | null;
  } | null;
}

export function useReplyIntents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('reply_intents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reply_intents' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reply_intents'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['reply_intents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reply_intents' as any)
        .select(`
          *,
          prospects:prospect_id (id, business_name, contact_name, email, lead_score)
        `)
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as unknown as ReplyIntent[]) || [];
    },
  });
}

export function useUpdateReplyIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'used' | 'dismissed' }) => {
      const { error } = await supabase
        .from('reply_intents' as any)
        .update({ status, used_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reply_intents'] });
    },
  });
}
