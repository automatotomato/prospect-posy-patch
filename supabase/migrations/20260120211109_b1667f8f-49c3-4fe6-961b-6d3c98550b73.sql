-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'reply',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Allow public read on notifications"
ON public.notifications
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on notifications"
ON public.notifications
FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete on notifications"
ON public.notifications
FOR DELETE
USING (true);

-- Add replied_at column to sent_emails for tracking
ALTER TABLE public.sent_emails
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;