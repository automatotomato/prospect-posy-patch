-- Add AI generation fields to follow_up_rules
ALTER TABLE follow_up_rules 
ADD COLUMN use_ai_generation boolean DEFAULT true,
ADD COLUMN ai_context text,
ADD COLUMN follow_up_number integer DEFAULT 1;

-- Add pre-generated content fields to scheduled_follow_ups
ALTER TABLE scheduled_follow_ups
ADD COLUMN subject text,
ADD COLUMN body text,
ADD COLUMN ai_generated boolean DEFAULT false;