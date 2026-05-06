
-- call_logs table
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  called_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  outcome text NOT NULL DEFAULT 'no_answer',
  notes text,
  contact_reached text,
  follow_up_date timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view call_logs" ON public.call_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert call_logs" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update call_logs" ON public.call_logs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete call_logs" ON public.call_logs FOR DELETE USING (auth.uid() IS NOT NULL);

-- conversions table
CREATE TABLE public.conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  type text NOT NULL,
  scheduled_for timestamptz,
  value numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view conversions" ON public.conversions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert conversions" ON public.conversions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update conversions" ON public.conversions FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete conversions" ON public.conversions FOR DELETE USING (auth.uid() IS NOT NULL);
