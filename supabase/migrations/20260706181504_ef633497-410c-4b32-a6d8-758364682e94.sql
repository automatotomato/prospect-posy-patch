
-- agent_runs: admin-only SELECT
DROP POLICY IF EXISTS "Authenticated users can view agent_runs" ON public.agent_runs;
CREATE POLICY "Admins can view agent_runs" ON public.agent_runs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- lead_costs: admin-only SELECT
DROP POLICY IF EXISTS "authenticated can read lead_costs" ON public.lead_costs;
CREATE POLICY "Admins can read lead_costs" ON public.lead_costs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- email_templates: admin-only SELECT
DROP POLICY IF EXISTS "Authenticated users can view email_templates" ON public.email_templates;
CREATE POLICY "Admins can view email_templates" ON public.email_templates
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- follow_up_rules: admin-only SELECT
DROP POLICY IF EXISTS "Authenticated users can view follow_up_rules" ON public.follow_up_rules;
CREATE POLICY "Admins can view follow_up_rules" ON public.follow_up_rules
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- sms_templates: admin-only SELECT
DROP POLICY IF EXISTS "Authenticated users can view sms_templates" ON public.sms_templates;
CREATE POLICY "Admins can view sms_templates" ON public.sms_templates
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- email_ingestion_log: admin-only all operations
DROP POLICY IF EXISTS "Authenticated users can view email_ingestion_log" ON public.email_ingestion_log;
DROP POLICY IF EXISTS "Authenticated users can insert email_ingestion_log" ON public.email_ingestion_log;
DROP POLICY IF EXISTS "Authenticated users can update email_ingestion_log" ON public.email_ingestion_log;
DROP POLICY IF EXISTS "Authenticated users can delete email_ingestion_log" ON public.email_ingestion_log;
CREATE POLICY "Admins can view email_ingestion_log" ON public.email_ingestion_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert email_ingestion_log" ON public.email_ingestion_log
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update email_ingestion_log" ON public.email_ingestion_log
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete email_ingestion_log" ON public.email_ingestion_log
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- campaigns: creator or admin
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON public.campaigns;
CREATE POLICY "Creators or admins view campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- campaign_steps: only when parent campaign is owned by user or user is admin
DROP POLICY IF EXISTS "Authenticated users can view campaign steps" ON public.campaign_steps;
DROP POLICY IF EXISTS "Authenticated users can manage campaign steps" ON public.campaign_steps;
CREATE POLICY "Creators or admins view campaign steps" ON public.campaign_steps
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_steps.campaign_id AND c.created_by = auth.uid())
  );
CREATE POLICY "Creators or admins manage campaign steps" ON public.campaign_steps
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_steps.campaign_id AND c.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_steps.campaign_id AND c.created_by = auth.uid())
  );

-- campaign_recipients: only when parent campaign is owned by user or user is admin
DROP POLICY IF EXISTS "Authenticated users can view campaign recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Authenticated users can manage campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Creators or admins view campaign recipients" ON public.campaign_recipients
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.created_by = auth.uid())
  );
CREATE POLICY "Creators or admins manage campaign recipients" ON public.campaign_recipients
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.created_by = auth.uid())
  );

-- clients: creator or admin
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "Creators or admins view clients" ON public.clients
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
