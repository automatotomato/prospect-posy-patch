import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OutreachQueueItem {
  id: string;
  prospect_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  email_type: string;
  status: string;
  generated_at: string;
  reviewed_at: string | null;
  sent_at: string | null;
  notes: string | null;
  prospects?: {
    business_name: string;
    location: string;
  } | null;
}

export interface ScheduledEmailItem {
  id: string;
  prospect_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  email_type: string | null;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  created_at: string;
  prospects?: {
    business_name: string;
    location: string;
  } | null;
}

export interface AgentRun {
  id: string;
  run_date: string;
  businesses_found: number;
  emails_generated: number;
  status: string;
  search_location: string | null;
  search_types: string[] | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export function useOutreachQueue() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('outreach-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_queue' }, () => {
        queryClient.invalidateQueries({ queryKey: ['outreach-queue'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['outreach-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_queue')
        .select('*, prospects(business_name, location)')
        .order('generated_at', { ascending: false });

      if (error) throw error;
      return data as OutreachQueueItem[];
    },
  });
}

export function useScheduledEmails() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('scheduled-emails-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_emails' }, () => {
        queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['scheduled-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select('*, prospects(business_name, location)')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      return data as ScheduledEmailItem[];
    },
    refetchInterval: 30000,
  });
}

// Real-time agent runs with live subscription
export function useAgentRuns() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('agent-runs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['agent-runs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['agent-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as AgentRun[];
    },
  });
}

export function useCancelScheduledEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduledEmailId: string) => {
      // Cancel the scheduled email
      const { error } = await supabase
        .from('scheduled_emails')
        .update({ status: 'cancelled' })
        .eq('id', scheduledEmailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-queue'] });
    },
  });
}

export function useBulkCancelScheduledEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('scheduled_emails')
        .update({ status: 'cancelled' })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-queue'] });
    },
  });
}

export function useUpdateQueueItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OutreachQueueItem> }) => {
      const { error } = await supabase
        .from('outreach_queue')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-queue'] });
    },
  });
}

export function useRunAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: settingsData } = await supabase
        .from('agent_settings')
        .select('setting_key, setting_value');

      const settings: Record<string, any> = {};
      settingsData?.forEach((row: any) => {
        settings[row.setting_key] = row.setting_value;
      });

      const discovery = settings.discovery || { location: 'Las Vegas, NV', locations: ['Las Vegas, NV'], targetCount: 50 };
      const businessTypes = settings.business_types || ['plumber', 'hvac_contractor', 'electrician'];

      const locations = discovery.locations || (discovery.location ? [discovery.location] : ['Las Vegas, NV']);
      const location = locations[Math.floor(Math.random() * locations.length)];

      const { data, error } = await supabase.functions.invoke('discover-businesses', {
        body: {
          location,
          targetCount: discovery.targetCount || 50,
          businessTypes,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-runs'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-queue'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

export function useRegenerateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueItem: OutreachQueueItem) => {
      const { data: prospect, error: prospectError } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', queueItem.prospect_id)
        .single();

      if (prospectError || !prospect) {
        throw new Error('Failed to fetch prospect data');
      }

      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: {
          businessData: {
            name: prospect.business_name,
            email: prospect.email,
            phone: prospect.phone,
            location: prospect.location,
            services: prospect.services,
            website: prospect.website,
          },
          emailType: 'introduction',
        },
      });

      if (error) throw error;

      const emailData = data?.data || data;
      
      if (!emailData?.subject || !emailData?.body) {
        throw new Error('Invalid email data returned');
      }

      const { error: updateError } = await supabase
        .from('outreach_queue')
        .update({
          subject: emailData.subject,
          body: emailData.body,
        })
        .eq('id', queueItem.id);

      if (updateError) throw updateError;

      return emailData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-queue'] });
    },
  });
}
