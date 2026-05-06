import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'sales_rep' | 'agent' | 'manager';

export function useCurrentRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current_role', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id);
      if (error) throw error;
      const roles = (data || []).map((r) => r.role as AppRole);
      return {
        roles,
        isAdmin: roles.includes('admin'),
        isSalesRep: roles.includes('sales_rep') || roles.includes('agent'),
      };
    },
    staleTime: 60_000,
  });
}
