-- Lead scoring columns on prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS lead_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

CREATE INDEX IF NOT EXISTS idx_prospects_lead_score ON public.prospects(lead_score DESC);

-- Reply intents table
CREATE TABLE IF NOT EXISTS public.reply_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  sent_email_id UUID,
  inbound_message_id TEXT,
  inbound_body TEXT,
  intent TEXT NOT NULL,
  confidence NUMERIC,
  urgency TEXT,
  suggested_subject TEXT,
  suggested_body TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reply_intents_status ON public.reply_intents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_intents_prospect ON public.reply_intents(prospect_id);

ALTER TABLE public.reply_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reply_intents"
  ON public.reply_intents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert reply_intents"
  ON public.reply_intents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update reply_intents"
  ON public.reply_intents FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete reply_intents"
  ON public.reply_intents FOR DELETE
  USING (auth.uid() IS NOT NULL);