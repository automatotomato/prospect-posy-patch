import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface ScheduleSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
}

export interface DiscoverySettings {
  location: string; // Legacy single location
  locations: string[]; // New multi-location support
  targetCount: number;
}

export interface DripSettings {
  enabled: boolean;
  interval_minutes: number;
  max_per_hour: number;
}

export interface AgentSettings {
  schedule: ScheduleSettings;
  discovery: DiscoverySettings;
  business_types: string[];
  drip_settings: DripSettings;
}

interface AgentSettingRow {
  id: string;
  setting_key: string;
  setting_value: Json;
  updated_at: string;
}

export function useAgentSettings() {
  return useQuery({
    queryKey: ['agent-settings'],
    queryFn: async (): Promise<AgentSettings> => {
      const { data, error } = await supabase
        .from('agent_settings')
        .select('*');

      if (error) throw error;

      const settings: AgentSettings = {
        schedule: { enabled: true, hour: 9, minute: 0, timezone: 'America/Los_Angeles' },
        discovery: { location: 'Las Vegas, NV', locations: ['Las Vegas, NV'], targetCount: 50 },
        business_types: [],
        drip_settings: { enabled: true, interval_minutes: 5, max_per_hour: 12 },
      };

      (data as AgentSettingRow[])?.forEach((row) => {
        if (row.setting_key === 'schedule') {
          settings.schedule = row.setting_value as unknown as ScheduleSettings;
        } else if (row.setting_key === 'discovery') {
          settings.discovery = row.setting_value as unknown as DiscoverySettings;
        } else if (row.setting_key === 'business_types') {
          settings.business_types = row.setting_value as unknown as string[];
        } else if (row.setting_key === 'drip_settings') {
          settings.drip_settings = row.setting_value as unknown as DripSettings;
        }
      });

      return settings;
    },
  });
}

export function useUpdateScheduleSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: ScheduleSettings) => {
      const { error } = await supabase
        .from('agent_settings')
        .update({ setting_value: schedule as unknown as Json })
        .eq('setting_key', 'schedule');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
    },
  });
}

export function useUpdateDiscoverySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (discovery: DiscoverySettings) => {
      const { error } = await supabase
        .from('agent_settings')
        .update({ setting_value: discovery as unknown as Json })
        .eq('setting_key', 'discovery');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
    },
  });
}

export function useUpdateBusinessTypes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessTypes: string[]) => {
      const { error } = await supabase
        .from('agent_settings')
        .update({ setting_value: businessTypes as unknown as Json })
        .eq('setting_key', 'business_types');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
    },
  });
}

export function useUpdateDripSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dripSettings: DripSettings) => {
      const { error } = await supabase
        .from('agent_settings')
        .upsert({ 
          setting_key: 'drip_settings',
          setting_value: dripSettings as unknown as Json 
        }, { onConflict: 'setting_key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
    },
  });
}
