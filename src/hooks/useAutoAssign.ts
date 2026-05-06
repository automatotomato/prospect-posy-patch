import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMembers } from '@/hooks/useProspects';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Returns a function that auto-assigns an unassigned prospect to the current
 * authenticated user (matched by email -> team_members.id). No-ops if the
 * prospect already has an owner or no matching team member exists.
 */
export function useAutoAssign() {
  const { user } = useAuth();
  const { data: teamMembers = [] } = useTeamMembers();
  const queryClient = useQueryClient();

  return useCallback(
    async (prospectId: string, currentAssignedTo?: string | null) => {
      if (!user?.email) return;
      if (currentAssignedTo) return; // already assigned

      const member = teamMembers.find(
        (m) => m.email.toLowerCase() === user.email!.toLowerCase()
      );
      if (!member) return;

      const { error } = await supabase
        .from('prospects')
        .update({ assigned_to: member.id })
        .eq('id', prospectId)
        .is('assigned_to', null); // race-safe: only claim if still unassigned

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['prospects'] });
      }
    },
    [user, teamMembers, queryClient]
  );
}

/** Returns the team_member.id for the current authenticated user, or null. */
export function useCurrentTeamMemberId(): string | null {
  const { user } = useAuth();
  const { data: teamMembers = [] } = useTeamMembers();
  if (!user?.email) return null;
  const member = teamMembers.find(
    (m) => m.email.toLowerCase() === user.email!.toLowerCase()
  );
  return member?.id ?? null;
}
