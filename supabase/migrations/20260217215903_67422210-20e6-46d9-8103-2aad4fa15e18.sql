
-- Fix RLS policies: restrict all tables to authenticated users only
-- Drop and recreate policies for each table

-- ============ PROSPECTS ============
DROP POLICY IF EXISTS "Authenticated users can view prospects" ON prospects;
DROP POLICY IF EXISTS "Authenticated users can insert prospects" ON prospects;
DROP POLICY IF EXISTS "Authenticated users can update prospects" ON prospects;
DROP POLICY IF EXISTS "Authenticated users can delete prospects" ON prospects;

CREATE POLICY "Authenticated users can view prospects" ON prospects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prospects" ON prospects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prospects" ON prospects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete prospects" ON prospects FOR DELETE TO authenticated USING (true);

-- ============ OUTREACH_QUEUE ============
DROP POLICY IF EXISTS "Users can view outreach queue" ON outreach_queue;
DROP POLICY IF EXISTS "Users can insert to outreach queue" ON outreach_queue;
DROP POLICY IF EXISTS "Users can update outreach queue" ON outreach_queue;
DROP POLICY IF EXISTS "Users can delete from outreach queue" ON outreach_queue;

CREATE POLICY "Authenticated users can view outreach queue" ON outreach_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert outreach queue" ON outreach_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update outreach queue" ON outreach_queue FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete outreach queue" ON outreach_queue FOR DELETE TO authenticated USING (true);

-- ============ SENT_EMAILS ============
DROP POLICY IF EXISTS "Allow public insert on sent_emails" ON sent_emails;
DROP POLICY IF EXISTS "Allow public read on sent_emails" ON sent_emails;
DROP POLICY IF EXISTS "Allow public update on sent_emails" ON sent_emails;

CREATE POLICY "Authenticated users can view sent_emails" ON sent_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sent_emails" ON sent_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sent_emails" ON sent_emails FOR UPDATE TO authenticated USING (true);

-- ============ EMAIL_EVENTS ============
DROP POLICY IF EXISTS "Allow public insert on email_events" ON email_events;
DROP POLICY IF EXISTS "Allow public read on email_events" ON email_events;

CREATE POLICY "Authenticated users can view email_events" ON email_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert email_events" ON email_events FOR INSERT TO authenticated WITH CHECK (true);

-- ============ SCHEDULED_EMAILS ============
DROP POLICY IF EXISTS "Allow public read on scheduled_emails" ON scheduled_emails;
DROP POLICY IF EXISTS "Allow public insert on scheduled_emails" ON scheduled_emails;
DROP POLICY IF EXISTS "Allow public update on scheduled_emails" ON scheduled_emails;
DROP POLICY IF EXISTS "Allow public delete on scheduled_emails" ON scheduled_emails;

CREATE POLICY "Authenticated users can view scheduled_emails" ON scheduled_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert scheduled_emails" ON scheduled_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update scheduled_emails" ON scheduled_emails FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete scheduled_emails" ON scheduled_emails FOR DELETE TO authenticated USING (true);

-- ============ SCHEDULED_FOLLOW_UPS ============
DROP POLICY IF EXISTS "Allow public read on scheduled_follow_ups" ON scheduled_follow_ups;
DROP POLICY IF EXISTS "Allow public insert on scheduled_follow_ups" ON scheduled_follow_ups;
DROP POLICY IF EXISTS "Allow public update on scheduled_follow_ups" ON scheduled_follow_ups;

CREATE POLICY "Authenticated users can view scheduled_follow_ups" ON scheduled_follow_ups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert scheduled_follow_ups" ON scheduled_follow_ups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update scheduled_follow_ups" ON scheduled_follow_ups FOR UPDATE TO authenticated USING (true);

-- ============ EMAIL_TEMPLATES ============
DROP POLICY IF EXISTS "Allow public read on email_templates" ON email_templates;
DROP POLICY IF EXISTS "Allow public insert on email_templates" ON email_templates;
DROP POLICY IF EXISTS "Allow public update on email_templates" ON email_templates;
DROP POLICY IF EXISTS "Allow public delete on email_templates" ON email_templates;

CREATE POLICY "Authenticated users can view email_templates" ON email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert email_templates" ON email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update email_templates" ON email_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete email_templates" ON email_templates FOR DELETE TO authenticated USING (true);

-- ============ FOLLOW_UP_RULES ============
DROP POLICY IF EXISTS "Allow public read on follow_up_rules" ON follow_up_rules;
DROP POLICY IF EXISTS "Allow public insert on follow_up_rules" ON follow_up_rules;
DROP POLICY IF EXISTS "Allow public update on follow_up_rules" ON follow_up_rules;
DROP POLICY IF EXISTS "Allow public delete on follow_up_rules" ON follow_up_rules;

CREATE POLICY "Authenticated users can view follow_up_rules" ON follow_up_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert follow_up_rules" ON follow_up_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update follow_up_rules" ON follow_up_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete follow_up_rules" ON follow_up_rules FOR DELETE TO authenticated USING (true);

-- ============ PROSPECT_TASKS ============
DROP POLICY IF EXISTS "Allow public read on prospect_tasks" ON prospect_tasks;
DROP POLICY IF EXISTS "Allow public insert on prospect_tasks" ON prospect_tasks;
DROP POLICY IF EXISTS "Allow public update on prospect_tasks" ON prospect_tasks;
DROP POLICY IF EXISTS "Allow public delete on prospect_tasks" ON prospect_tasks;

CREATE POLICY "Authenticated users can view prospect_tasks" ON prospect_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prospect_tasks" ON prospect_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prospect_tasks" ON prospect_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete prospect_tasks" ON prospect_tasks FOR DELETE TO authenticated USING (true);

-- ============ AGENT_SETTINGS ============
DROP POLICY IF EXISTS "Authenticated users can view agent settings" ON agent_settings;
DROP POLICY IF EXISTS "Authenticated users can insert agent settings" ON agent_settings;
DROP POLICY IF EXISTS "Authenticated users can update agent settings" ON agent_settings;

CREATE POLICY "Authenticated users can view agent_settings" ON agent_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert agent_settings" ON agent_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update agent_settings" ON agent_settings FOR UPDATE TO authenticated USING (true);

-- ============ AGENT_RUNS ============
DROP POLICY IF EXISTS "Users can view agent runs" ON agent_runs;
DROP POLICY IF EXISTS "Users can insert agent runs" ON agent_runs;
DROP POLICY IF EXISTS "Users can update agent runs" ON agent_runs;

CREATE POLICY "Authenticated users can view agent_runs" ON agent_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert agent_runs" ON agent_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update agent_runs" ON agent_runs FOR UPDATE TO authenticated USING (true);

-- ============ EMAIL_INGESTION_LOG ============
DROP POLICY IF EXISTS "Allow public access on email_ingestion_log" ON email_ingestion_log;

CREATE POLICY "Authenticated users can access email_ingestion_log" ON email_ingestion_log FOR ALL TO authenticated USING (true);

-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "Allow public read on notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public insert on notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public update on notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public delete on notifications" ON notifications;

CREATE POLICY "Authenticated users can view notifications" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update notifications" ON notifications FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete notifications" ON notifications FOR DELETE TO authenticated USING (true);

-- ============ TEAM_MEMBERS (SELECT was public) ============
DROP POLICY IF EXISTS "Authenticated users can view team_members" ON team_members;

CREATE POLICY "Authenticated users can view team_members" ON team_members FOR SELECT TO authenticated USING (true);
