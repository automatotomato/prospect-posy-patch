-- 1. Add 'called' to prospect_status enum
ALTER TYPE public.prospect_status ADD VALUE IF NOT EXISTS 'called' AFTER 'new';
