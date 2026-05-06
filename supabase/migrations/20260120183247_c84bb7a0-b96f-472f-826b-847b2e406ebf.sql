-- Add drip_settings to agent_settings table
INSERT INTO agent_settings (setting_key, setting_value)
VALUES ('drip_settings', '{"enabled": true, "interval_minutes": 5, "max_per_hour": 12}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;