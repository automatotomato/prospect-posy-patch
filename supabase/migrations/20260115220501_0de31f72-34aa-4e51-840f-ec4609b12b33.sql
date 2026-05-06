-- Add unsubscribe tracking to prospects table
ALTER TABLE prospects 
ADD COLUMN IF NOT EXISTS unsubscribed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp with time zone;

-- Create index for quick filtering of unsubscribed prospects
CREATE INDEX IF NOT EXISTS idx_prospects_unsubscribed ON prospects(unsubscribed) WHERE unsubscribed = true;