
-- Add industry column to prospects
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS industry text;

-- Backfill industry from notes field
UPDATE public.prospects
SET industry = CASE
  WHEN notes LIKE '%Industry: %' THEN
    substring(notes FROM 'Industry: ([a-z_]+)')
  WHEN notes LIKE '%Types: %' THEN
    split_part(substring(notes FROM 'Types: ([a-z_]+)'), ',', 1)
  ELSE NULL
END
WHERE industry IS NULL AND notes IS NOT NULL;
