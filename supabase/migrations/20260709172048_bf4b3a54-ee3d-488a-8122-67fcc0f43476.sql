ALTER TABLE public.lead_costs ADD COLUMN IF NOT EXISTS ai_new_daily_cap integer NOT NULL DEFAULT 50;
ALTER TABLE public.lead_costs ADD COLUMN IF NOT EXISTS followup_daily_cap integer NOT NULL DEFAULT 150;
UPDATE public.lead_costs SET daily_send_cap = 200, ai_new_daily_cap = 50, followup_daily_cap = 150 WHERE id = 'default';