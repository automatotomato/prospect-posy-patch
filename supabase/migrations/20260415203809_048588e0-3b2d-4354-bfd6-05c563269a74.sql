DROP INDEX IF EXISTS public.scheduled_follow_ups_unique_pending_per_prospect_rule;

WITH ranked_pending AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(prospect_id, sent_email_id)
      ORDER BY scheduled_for ASC, created_at ASC, id ASC
    ) AS row_num
  FROM public.scheduled_follow_ups
  WHERE status = 'pending'
)
UPDATE public.scheduled_follow_ups sfu
SET status = 'cancelled'
FROM ranked_pending rp
WHERE sfu.id = rp.id
  AND rp.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_follow_ups_unique_pending_per_target
ON public.scheduled_follow_ups (COALESCE(prospect_id, sent_email_id))
WHERE status = 'pending';