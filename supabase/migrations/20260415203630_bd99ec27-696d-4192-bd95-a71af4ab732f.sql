WITH ranked_pending AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY prospect_id, follow_up_rule_id, status
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

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_follow_ups_unique_pending_per_prospect_rule
ON public.scheduled_follow_ups (prospect_id, follow_up_rule_id)
WHERE status = 'pending' AND prospect_id IS NOT NULL;