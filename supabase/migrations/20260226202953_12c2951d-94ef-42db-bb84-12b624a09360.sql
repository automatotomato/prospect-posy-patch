
-- Index on resend_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_sent_emails_resend_id ON public.sent_emails(resend_id) WHERE resend_id IS NOT NULL;

-- Index for sync scanning path
CREATE INDEX IF NOT EXISTS idx_sent_emails_status_sent_at ON public.sent_emails(status, sent_at DESC);
