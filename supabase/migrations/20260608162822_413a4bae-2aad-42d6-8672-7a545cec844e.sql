
-- Extend sales_leads
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Backfill stage from status
UPDATE public.sales_leads SET stage = CASE
  WHEN status = 'sent' THEN 'contacted'
  WHEN status = 'drafted' THEN 'new'
  ELSE 'new'
END WHERE stage = 'new';

CREATE INDEX IF NOT EXISTS idx_sales_leads_stage ON public.sales_leads(stage);
CREATE INDEX IF NOT EXISTS idx_sales_leads_follow_up_at ON public.sales_leads(follow_up_at);

-- Activities log
CREATE TABLE IF NOT EXISTS public.sales_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  note text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_activities TO authenticated;
GRANT ALL ON public.sales_activities TO service_role;

ALTER TABLE public.sales_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their activities"
  ON public.sales_activities FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners insert their activities"
  ON public.sales_activities FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners delete their activities"
  ON public.sales_activities FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sales_activities_lead ON public.sales_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_owner ON public.sales_activities(owner_id, created_at DESC);
