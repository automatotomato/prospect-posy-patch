-- Add unique constraint on setting_key to prevent duplicates
ALTER TABLE agent_settings ADD CONSTRAINT agent_settings_setting_key_unique UNIQUE (setting_key);

-- Insert default schedule settings (daily at 9 AM PT)
INSERT INTO agent_settings (setting_key, setting_value)
VALUES ('schedule', '{"enabled": true, "hour": 9, "minute": 0, "timezone": "America/Los_Angeles"}')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default discovery settings (50 businesses in Las Vegas)
INSERT INTO agent_settings (setting_key, setting_value)
VALUES ('discovery', '{"location": "Las Vegas, NV", "targetCount": 50}')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default business types
INSERT INTO agent_settings (setting_key, setting_value)
VALUES ('business_types', '["plumber", "hvac_contractor", "electrician", "general_contractor", "roofing_contractor", "towing_service", "locksmith"]')
ON CONFLICT (setting_key) DO NOTHING;