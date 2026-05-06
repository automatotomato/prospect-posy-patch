import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Prospect, ProspectStatus, LeadSource, Task, TeamMember } from '@/types/prospect';

// Fetch all prospects from database
export function useProspects() {
  return useQuery({
    queryKey: ['prospects'],
    queryFn: async () => {
      // Paginate to fetch all prospects beyond the 1000-row default
      let allProspects: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('prospects')
          .select(`
            *,
            prospect_tasks (*)
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (pageError) throw pageError;
        if (!page || page.length === 0) break;
        allProspects = allProspects.concat(page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      const prospects = allProspects;
      const error = null;

      if (error) throw error;

      // Transform to match our Prospect type
      return prospects.map((p): Prospect => ({
        id: p.id,
        businessName: p.business_name,
        contactName: p.contact_name || undefined,
        phone: p.phone || undefined,
        email: p.email || undefined,
        location: p.location,
        vehicleCount: p.vehicle_count || undefined,
        vehicleTypes: p.vehicle_types || undefined,
        notes: p.notes || '',
        status: p.status as ProspectStatus,
        source: p.source as LeadSource,
        assignedTo: p.assigned_to || '',
        createdAt: new Date(p.created_at),
        nextFollowUp: p.next_follow_up ? new Date(p.next_follow_up) : undefined,
        imageUrl: p.image_url || undefined,
        movedToQuoting: p.moved_to_quoting,
        doNotContact: (p as any).do_not_contact || false,
        doNotContactReason: (p as any).do_not_contact_reason || undefined,
        website: p.website || undefined,
        facebookUrl: p.facebook_url || undefined,
        instagramUrl: p.instagram_url || undefined,
        linkedinUrl: p.linkedin_url || undefined,
        yelpUrl: p.yelp_url || undefined,
        industry: (p as any).industry || undefined,
        leadScore: (p as any).lead_score ?? undefined,
        scoreBreakdown: (p as any).score_breakdown ?? undefined,
        scoreUpdatedAt: (p as any).score_updated_at ? new Date((p as any).score_updated_at) : undefined,
        tasks: (p.prospect_tasks || []).map((t: Record<string, unknown>): Task => ({
          id: t.id as string,
          type: t.type as Task['type'],
          description: t.description as string,
          dueDate: new Date(t.due_date as string),
          completed: t.completed as boolean,
        })),
      }));
    },
  });
}

// Fetch team members
export function useTeamMembers() {
  return useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name');

      if (error) throw error;

      return data.map((m): TeamMember => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role as TeamMember['role'],
      }));
    },
  });
}

// Add a new prospect
export function useAddProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospect: Omit<Prospect, 'id' | 'createdAt' | 'tasks'>) => {
      const { data, error } = await supabase
        .from('prospects')
        .insert({
          business_name: prospect.businessName,
          contact_name: prospect.contactName || null,
          phone: prospect.phone || null,
          email: prospect.email || null,
          location: prospect.location || 'Unknown',
          vehicle_count: prospect.vehicleCount || null,
          vehicle_types: prospect.vehicleTypes || null,
          notes: prospect.notes || '',
          status: prospect.status,
          source: prospect.source as 'field_photo' | 'email' | 'referral' | 'website' | 'cold_call',
          assigned_to: prospect.assignedTo || null,
          next_follow_up: prospect.nextFollowUp?.toISOString() || null,
          moved_to_quoting: prospect.movedToQuoting,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial task
      await supabase
        .from('prospect_tasks')
        .insert({
          prospect_id: data.id,
          type: 'call',
          description: 'Initial introduction call',
          due_date: prospect.nextFollowUp?.toISOString() || new Date().toISOString(),
          completed: false,
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

// Add multiple prospects at once (for CSV import)
export function useAddProspects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospects: Omit<Prospect, 'id' | 'createdAt' | 'tasks'>[]) => {
      const insertData = prospects.map(prospect => ({
        business_name: prospect.businessName,
        contact_name: prospect.contactName || null,
        phone: prospect.phone || null,
        email: prospect.email || null,
        location: prospect.location || 'Unknown',
        vehicle_count: prospect.vehicleCount || null,
        vehicle_types: prospect.vehicleTypes || null,
        notes: prospect.notes || '',
        status: prospect.status,
        source: prospect.source as 'field_photo' | 'email' | 'referral' | 'website' | 'cold_call',
        assigned_to: prospect.assignedTo || null,
        next_follow_up: prospect.nextFollowUp?.toISOString() || null,
        moved_to_quoting: prospect.movedToQuoting,
      }));

      const { data, error } = await supabase
        .from('prospects')
        .insert(insertData)
        .select();

      if (error) throw error;

      // Create initial tasks for each prospect
      if (data && data.length > 0) {
        const tasks = data.map((p, i) => ({
          prospect_id: p.id,
          type: 'call' as const,
          description: 'Initial introduction call',
          due_date: prospects[i].nextFollowUp?.toISOString() || new Date().toISOString(),
          completed: false,
        }));

        await supabase.from('prospect_tasks').insert(tasks);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

// Update a prospect
export function useUpdateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Prospect> }) => {
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName;
      if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.vehicleCount !== undefined) dbUpdates.vehicle_count = updates.vehicleCount;
      if (updates.vehicleTypes !== undefined) dbUpdates.vehicle_types = updates.vehicleTypes;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.source !== undefined) dbUpdates.source = updates.source;
      if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo || null;
      if (updates.nextFollowUp !== undefined) dbUpdates.next_follow_up = updates.nextFollowUp?.toISOString();
      if (updates.movedToQuoting !== undefined) dbUpdates.moved_to_quoting = updates.movedToQuoting;
      if (updates.doNotContact !== undefined) dbUpdates.do_not_contact = updates.doNotContact;
      if (updates.doNotContactReason !== undefined) dbUpdates.do_not_contact_reason = updates.doNotContactReason;

      const { data, error } = await supabase
        .from('prospects')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

// Toggle task completion
export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('prospect_tasks')
        .update({ completed })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

// Delete a prospect
export function useDeleteProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete tasks first (due to foreign key)
      await supabase
        .from('prospect_tasks')
        .delete()
        .eq('prospect_id', id);

      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

// Fetch email ingestion stats
export function useEmailIngestionStats() {
  return useQuery({
    queryKey: ['email_ingestion_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_ingestion_log')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
