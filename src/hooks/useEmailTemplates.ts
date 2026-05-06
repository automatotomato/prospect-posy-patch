import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
}

export function useScheduledEmails() {
  return useQuery({
    queryKey: ['scheduled-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select('*')
        .order('scheduled_for', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}
