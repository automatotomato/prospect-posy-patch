-- Add 'responded' to the prospect_status enum
ALTER TYPE prospect_status ADD VALUE 'responded' AFTER 'contacted';