-- Backfill: move existing 'contacted' prospects back to 'new'
UPDATE public.prospects SET status = 'new' WHERE status = 'contacted';

-- SMS Templates
CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  category text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sms_templates"
  ON public.sms_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert sms_templates"
  ON public.sms_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sms_templates"
  ON public.sms_templates FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sms_templates"
  ON public.sms_templates FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sent SMS log
CREATE TABLE public.sent_sms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid,
  to_phone text NOT NULL,
  from_phone text,
  body text NOT NULL,
  twilio_sid text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_by uuid
);

CREATE INDEX idx_sent_sms_prospect ON public.sent_sms(prospect_id);
CREATE INDEX idx_sent_sms_sent_at ON public.sent_sms(sent_at DESC);
CREATE INDEX idx_sent_sms_twilio_sid ON public.sent_sms(twilio_sid);

ALTER TABLE public.sent_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sent_sms"
  ON public.sent_sms FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert sent_sms"
  ON public.sent_sms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sent_sms"
  ON public.sent_sms FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sent_sms"
  ON public.sent_sms FOR DELETE
  USING (auth.uid() IS NOT NULL);
