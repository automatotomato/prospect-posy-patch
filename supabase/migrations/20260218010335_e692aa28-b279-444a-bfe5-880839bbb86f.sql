
-- Fix overly permissive RLS policies (USING true → require authenticated session)
-- Since this is a single-user app, we replace USING(true) with (auth.uid() IS NOT NULL)
-- This ensures only authenticated sessions can access data.

-- email_templates
DROP POLICY IF EXISTS "Authenticated users can view email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can insert email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete email_templates" ON public.email_templates;

CREATE POLICY "Authenticated users can view email_templates" ON public.email_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert email_templates" ON public.email_templates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update email_templates" ON public.email_templates FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete email_templates" ON public.email_templates FOR DELETE USING (auth.uid() IS NOT NULL);

-- follow_up_rules
DROP POLICY IF EXISTS "Authenticated users can view follow_up_rules" ON public.follow_up_rules;
DROP POLICY IF EXISTS "Authenticated users can insert follow_up_rules" ON public.follow_up_rules;
DROP POLICY IF EXISTS "Authenticated users can update follow_up_rules" ON public.follow_up_rules;
DROP POLICY IF EXISTS "Authenticated users can delete follow_up_rules" ON public.follow_up_rules;

CREATE POLICY "Authenticated users can view follow_up_rules" ON public.follow_up_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert follow_up_rules" ON public.follow_up_rules FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update follow_up_rules" ON public.follow_up_rules FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete follow_up_rules" ON public.follow_up_rules FOR DELETE USING (auth.uid() IS NOT NULL);

-- prospect_tasks
DROP POLICY IF EXISTS "Authenticated users can view prospect_tasks" ON public.prospect_tasks;
DROP POLICY IF EXISTS "Authenticated users can insert prospect_tasks" ON public.prospect_tasks;
DROP POLICY IF EXISTS "Authenticated users can update prospect_tasks" ON public.prospect_tasks;
DROP POLICY IF EXISTS "Authenticated users can delete prospect_tasks" ON public.prospect_tasks;

CREATE POLICY "Authenticated users can view prospect_tasks" ON public.prospect_tasks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert prospect_tasks" ON public.prospect_tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update prospect_tasks" ON public.prospect_tasks FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete prospect_tasks" ON public.prospect_tasks FOR DELETE USING (auth.uid() IS NOT NULL);

-- scheduled_emails
DROP POLICY IF EXISTS "Authenticated users can view scheduled_emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled_emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can update scheduled_emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can delete scheduled_emails" ON public.scheduled_emails;

CREATE POLICY "Authenticated users can view scheduled_emails" ON public.scheduled_emails FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert scheduled_emails" ON public.scheduled_emails FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update scheduled_emails" ON public.scheduled_emails FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete scheduled_emails" ON public.scheduled_emails FOR DELETE USING (auth.uid() IS NOT NULL);

-- scheduled_follow_ups
DROP POLICY IF EXISTS "Authenticated users can view scheduled_follow_ups" ON public.scheduled_follow_ups;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled_follow_ups" ON public.scheduled_follow_ups;
DROP POLICY IF EXISTS "Authenticated users can update scheduled_follow_ups" ON public.scheduled_follow_ups;

CREATE POLICY "Authenticated users can view scheduled_follow_ups" ON public.scheduled_follow_ups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert scheduled_follow_ups" ON public.scheduled_follow_ups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update scheduled_follow_ups" ON public.scheduled_follow_ups FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete scheduled_follow_ups" ON public.scheduled_follow_ups FOR DELETE USING (auth.uid() IS NOT NULL);

-- sent_emails
DROP POLICY IF EXISTS "Authenticated users can view sent_emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can insert sent_emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can update sent_emails" ON public.sent_emails;

CREATE POLICY "Authenticated users can view sent_emails" ON public.sent_emails FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert sent_emails" ON public.sent_emails FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update sent_emails" ON public.sent_emails FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete sent_emails" ON public.sent_emails FOR DELETE USING (auth.uid() IS NOT NULL);

-- email_events
DROP POLICY IF EXISTS "Authenticated users can view email_events" ON public.email_events;
DROP POLICY IF EXISTS "Authenticated users can insert email_events" ON public.email_events;

CREATE POLICY "Authenticated users can view email_events" ON public.email_events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert email_events" ON public.email_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- email_ingestion_log
DROP POLICY IF EXISTS "Authenticated users can access email_ingestion_log" ON public.email_ingestion_log;

CREATE POLICY "Authenticated users can view email_ingestion_log" ON public.email_ingestion_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert email_ingestion_log" ON public.email_ingestion_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update email_ingestion_log" ON public.email_ingestion_log FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete email_ingestion_log" ON public.email_ingestion_log FOR DELETE USING (auth.uid() IS NOT NULL);

-- notifications
DROP POLICY IF EXISTS "Authenticated users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can delete notifications" ON public.notifications;

CREATE POLICY "Authenticated users can view notifications" ON public.notifications FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update notifications" ON public.notifications FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete notifications" ON public.notifications FOR DELETE USING (auth.uid() IS NOT NULL);

-- outreach_queue
DROP POLICY IF EXISTS "Authenticated users can view outreach queue" ON public.outreach_queue;
DROP POLICY IF EXISTS "Authenticated users can insert outreach queue" ON public.outreach_queue;
DROP POLICY IF EXISTS "Authenticated users can update outreach queue" ON public.outreach_queue;
DROP POLICY IF EXISTS "Authenticated users can delete outreach queue" ON public.outreach_queue;

CREATE POLICY "Authenticated users can view outreach queue" ON public.outreach_queue FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert outreach queue" ON public.outreach_queue FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update outreach queue" ON public.outreach_queue FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete outreach queue" ON public.outreach_queue FOR DELETE USING (auth.uid() IS NOT NULL);

-- agent_runs
DROP POLICY IF EXISTS "Authenticated users can view agent_runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Authenticated users can insert agent_runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Authenticated users can update agent_runs" ON public.agent_runs;

CREATE POLICY "Authenticated users can view agent_runs" ON public.agent_runs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert agent_runs" ON public.agent_runs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update agent_runs" ON public.agent_runs FOR UPDATE USING (auth.uid() IS NOT NULL);

-- agent_settings
DROP POLICY IF EXISTS "Authenticated users can view agent_settings" ON public.agent_settings;
DROP POLICY IF EXISTS "Authenticated users can insert agent_settings" ON public.agent_settings;
DROP POLICY IF EXISTS "Authenticated users can update agent_settings" ON public.agent_settings;

CREATE POLICY "Authenticated users can view agent_settings" ON public.agent_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert agent_settings" ON public.agent_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update agent_settings" ON public.agent_settings FOR UPDATE USING (auth.uid() IS NOT NULL);

-- prospects
DROP POLICY IF EXISTS "Authenticated users can view prospects" ON public.prospects;
DROP POLICY IF EXISTS "Authenticated users can insert prospects" ON public.prospects;
DROP POLICY IF EXISTS "Authenticated users can update prospects" ON public.prospects;
DROP POLICY IF EXISTS "Authenticated users can delete prospects" ON public.prospects;

CREATE POLICY "Authenticated users can view prospects" ON public.prospects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert prospects" ON public.prospects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update prospects" ON public.prospects FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete prospects" ON public.prospects FOR DELETE USING (auth.uid() IS NOT NULL);

-- profiles (keep existing owner-scoped but fix SELECT)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
