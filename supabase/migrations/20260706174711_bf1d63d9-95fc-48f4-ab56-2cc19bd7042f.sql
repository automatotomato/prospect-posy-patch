-- 1) Classification columns on sales_leads
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS lead_type text,
  ADD COLUMN IF NOT EXISTS origin    text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_leads_lead_type_check') THEN
    ALTER TABLE public.sales_leads
      ADD CONSTRAINT sales_leads_lead_type_check CHECK (lead_type IN ('direct','general'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_leads_origin_check') THEN
    ALTER TABLE public.sales_leads
      ADD CONSTRAINT sales_leads_origin_check CHECK (origin IN ('mine','ai'));
  END IF;
END $$;

-- 2) Backfill origin from existing `source`
UPDATE public.sales_leads
   SET origin = CASE
     WHEN source IN ('my_contacts','upload','scan','business_card') THEN 'mine'
     ELSE 'ai'
   END
 WHERE origin IS NULL;

-- 3) Backfill lead_type from email local-part
UPDATE public.sales_leads
   SET lead_type = CASE
     WHEN email IS NULL THEN 'general'
     WHEN lower(split_part(email, '@', 1)) = ANY (ARRAY[
       'info','sales','hello','contact','support','admin','office','hr',
       'marketing','billing','careers','team','help','no-reply','noreply',
       'accounts','accounting','service','services','enquiries','inquiries',
       'general','reception','front-desk','frontdesk','feedback','press','media'
     ]) THEN 'general'
     ELSE 'direct'
   END
 WHERE lead_type IS NULL;

-- 4) Index for dashboard slice queries
CREATE INDEX IF NOT EXISTS sales_leads_origin_type_stage_idx
  ON public.sales_leads (origin, lead_type, stage);

-- 5) lead_costs single-row config
CREATE TABLE IF NOT EXISTS public.lead_costs (
  id text PRIMARY KEY DEFAULT 'default',
  ai_cost_per_lead numeric NOT NULL DEFAULT 0,
  mine_cost_per_lead numeric NOT NULL DEFAULT 0,
  daily_send_cap integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_costs TO authenticated;
GRANT ALL    ON public.lead_costs TO service_role;

ALTER TABLE public.lead_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read lead_costs" ON public.lead_costs;
CREATE POLICY "authenticated can read lead_costs"
  ON public.lead_costs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admins can update lead_costs" ON public.lead_costs;
CREATE POLICY "admins can update lead_costs"
  ON public.lead_costs FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins can insert lead_costs" ON public.lead_costs;
CREATE POLICY "admins can insert lead_costs"
  ON public.lead_costs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.lead_costs (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;