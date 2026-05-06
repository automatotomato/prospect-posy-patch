ALTER TABLE public.prospects
ADD COLUMN IF NOT EXISTS email_recrawled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS email_recrawl_status text,
ADD COLUMN IF NOT EXISTS email_recrawl_error text,
ADD COLUMN IF NOT EXISTS email_source text;

CREATE INDEX IF NOT EXISTS idx_prospects_email_recrawl_queue
ON public.prospects (email_recrawled_at NULLS FIRST, updated_at)
WHERE website IS NOT NULL AND do_not_contact = false AND unsubscribed = false;

CREATE INDEX IF NOT EXISTS idx_prospects_email_recrawl_status
ON public.prospects (email_recrawl_status)
WHERE email_recrawl_status IS NOT NULL;