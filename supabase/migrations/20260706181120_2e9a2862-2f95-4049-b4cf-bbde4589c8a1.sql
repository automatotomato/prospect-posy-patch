
-- Backfill missing "Mine" leads from clients so all uploaded contacts appear in the pipeline.
WITH eligible AS (
  SELECT DISTINCT ON (lower(c.email))
    c.id, c.business_name, c.email, c.phone, c.industry, c.location,
    COALESCE(c.created_by, (SELECT owner_id FROM public.sales_leads WHERE source='my_contacts' AND owner_id IS NOT NULL LIMIT 1)) AS owner_id
  FROM public.clients c
  WHERE c.email IS NOT NULL AND c.email <> ''
    AND COALESCE(c.do_not_contact,false) = false
    AND COALESCE(c.unsubscribed,false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.sales_leads sl WHERE lower(sl.email) = lower(c.email)
    )
  ORDER BY lower(c.email), c.created_at DESC
)
INSERT INTO public.sales_leads
  (owner_id, business_name, email, phone, city, state, industry,
   source, origin, lead_type, status, stage, queued_at, last_activity_at, contact_count)
SELECT
  e.owner_id,
  e.business_name,
  e.email,
  e.phone,
  NULLIF(split_part(e.location, ',', 1), ''),
  NULLIF(btrim(split_part(e.location, ',', 2)), ''),
  e.industry,
  'my_contacts',
  'mine',
  CASE
    WHEN split_part(lower(e.email), '@', 1) IN
      ('info','sales','hello','contact','support','admin','office','hr',
       'marketing','billing','careers','team','help','no-reply','noreply',
       'accounts','accounting','service','services','enquiries','inquiries',
       'general','reception','front-desk','frontdesk','feedback','press','media')
    THEN 'general' ELSE 'direct'
  END,
  'new',
  'queued',
  now(),
  now(),
  0
FROM eligible e
WHERE e.owner_id IS NOT NULL;
