
-- Allowed users (invite list)
CREATE TABLE IF NOT EXISTS public.allowed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'sales_rep',
  name text,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view allowed_users" ON public.allowed_users FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert allowed_users" ON public.allowed_users FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update allowed_users" ON public.allowed_users FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete allowed_users" ON public.allowed_users FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Link team_members to auth.users
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;

-- Helpers
CREATE OR REPLACE FUNCTION public.current_team_member_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_prospect(_prospect_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.prospects p
        WHERE p.id = _prospect_id
          AND p.assigned_to = public.current_team_member_id()
      )
$$;

-- Updated handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _allowed RECORD;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO _allowed FROM public.allowed_users WHERE lower(email) = lower(new.email) LIMIT 1;

  IF _allowed.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, _allowed.role) ON CONFLICT DO NOTHING;

    UPDATE public.team_members SET user_id = new.id
     WHERE lower(email) = lower(new.email) AND user_id IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.team_members (name, email, role, user_id)
      VALUES (
        COALESCE(_allowed.name, split_part(new.email, '@', 1)),
        new.email,
        CASE WHEN _allowed.role = 'admin' THEN 'manager'::team_role ELSE 'agent'::team_role END,
        new.id
      ) ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.allowed_users SET accepted_at = COALESCE(accepted_at, now()) WHERE id = _allowed.id;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed admins
INSERT INTO public.allowed_users (email, role, name, accepted_at) VALUES
  ('alex@automateplanet.com', 'admin', 'Alex', now()),
  ('nick.k.mccarthy@gmail.com', 'admin', 'Nick', now())
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role FROM auth.users u
WHERE lower(u.email) IN ('alex@automateplanet.com', 'nick.k.mccarthy@gmail.com')
ON CONFLICT DO NOTHING;

UPDATE public.team_members tm SET user_id = u.id
  FROM auth.users u
 WHERE tm.user_id IS NULL AND lower(tm.email) = lower(u.email);

-- prospects RLS
DROP POLICY IF EXISTS "Authenticated users can view prospects" ON public.prospects;
DROP POLICY IF EXISTS "Authenticated users can insert prospects" ON public.prospects;
DROP POLICY IF EXISTS "Authenticated users can update prospects" ON public.prospects;
DROP POLICY IF EXISTS "Authenticated users can delete prospects" ON public.prospects;

CREATE POLICY "View prospects (admin or assigned)" ON public.prospects FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR assigned_to = public.current_team_member_id());
CREATE POLICY "Admins can insert prospects" ON public.prospects FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Update prospects (admin or assigned)" ON public.prospects FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR assigned_to = public.current_team_member_id());
CREATE POLICY "Admins can delete prospects" ON public.prospects FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- prospect_tasks
DROP POLICY IF EXISTS "Authenticated users can view prospect_tasks" ON public.prospect_tasks;
DROP POLICY IF EXISTS "Authenticated users can insert prospect_tasks" ON public.prospect_tasks;
DROP POLICY IF EXISTS "Authenticated users can update prospect_tasks" ON public.prospect_tasks;
DROP POLICY IF EXISTS "Authenticated users can delete prospect_tasks" ON public.prospect_tasks;
CREATE POLICY "View prospect_tasks via prospect" ON public.prospect_tasks FOR SELECT TO authenticated USING (public.can_access_prospect(prospect_id));
CREATE POLICY "Insert prospect_tasks via prospect" ON public.prospect_tasks FOR INSERT TO authenticated WITH CHECK (public.can_access_prospect(prospect_id));
CREATE POLICY "Update prospect_tasks via prospect" ON public.prospect_tasks FOR UPDATE TO authenticated USING (public.can_access_prospect(prospect_id));
CREATE POLICY "Delete prospect_tasks via prospect" ON public.prospect_tasks FOR DELETE TO authenticated USING (public.can_access_prospect(prospect_id));

-- call_logs
DROP POLICY IF EXISTS "Authenticated users can view call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Authenticated users can insert call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Authenticated users can update call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Authenticated users can delete call_logs" ON public.call_logs;
CREATE POLICY "View call_logs via prospect" ON public.call_logs FOR SELECT TO authenticated USING (public.can_access_prospect(prospect_id));
CREATE POLICY "Insert call_logs via prospect" ON public.call_logs FOR INSERT TO authenticated WITH CHECK (public.can_access_prospect(prospect_id));
CREATE POLICY "Update call_logs via prospect" ON public.call_logs FOR UPDATE TO authenticated USING (public.can_access_prospect(prospect_id));
CREATE POLICY "Delete call_logs via prospect" ON public.call_logs FOR DELETE TO authenticated USING (public.can_access_prospect(prospect_id));

-- sent_emails (allow null prospect_id for admins)
DROP POLICY IF EXISTS "Authenticated users can view sent_emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can insert sent_emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can update sent_emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can delete sent_emails" ON public.sent_emails;
CREATE POLICY "View sent_emails" ON public.sent_emails FOR SELECT TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Insert sent_emails" ON public.sent_emails FOR INSERT TO authenticated WITH CHECK ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Update sent_emails" ON public.sent_emails FOR UPDATE TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Delete sent_emails" ON public.sent_emails FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- sent_sms
DROP POLICY IF EXISTS "Authenticated users can view sent_sms" ON public.sent_sms;
DROP POLICY IF EXISTS "Authenticated users can insert sent_sms" ON public.sent_sms;
DROP POLICY IF EXISTS "Authenticated users can update sent_sms" ON public.sent_sms;
DROP POLICY IF EXISTS "Authenticated users can delete sent_sms" ON public.sent_sms;
CREATE POLICY "View sent_sms" ON public.sent_sms FOR SELECT TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Insert sent_sms" ON public.sent_sms FOR INSERT TO authenticated WITH CHECK ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Update sent_sms" ON public.sent_sms FOR UPDATE TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Delete sent_sms" ON public.sent_sms FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- scheduled_emails
DROP POLICY IF EXISTS "Authenticated users can view scheduled_emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled_emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can update scheduled_emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can delete scheduled_emails" ON public.scheduled_emails;
CREATE POLICY "View scheduled_emails" ON public.scheduled_emails FOR SELECT TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Insert scheduled_emails" ON public.scheduled_emails FOR INSERT TO authenticated WITH CHECK ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Update scheduled_emails" ON public.scheduled_emails FOR UPDATE TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Delete scheduled_emails" ON public.scheduled_emails FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- scheduled_follow_ups
DROP POLICY IF EXISTS "Authenticated users can view scheduled_follow_ups" ON public.scheduled_follow_ups;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled_follow_ups" ON public.scheduled_follow_ups;
DROP POLICY IF EXISTS "Authenticated users can update scheduled_follow_ups" ON public.scheduled_follow_ups;
DROP POLICY IF EXISTS "Authenticated users can delete scheduled_follow_ups" ON public.scheduled_follow_ups;
CREATE POLICY "View scheduled_follow_ups" ON public.scheduled_follow_ups FOR SELECT TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Insert scheduled_follow_ups" ON public.scheduled_follow_ups FOR INSERT TO authenticated WITH CHECK ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Update scheduled_follow_ups" ON public.scheduled_follow_ups FOR UPDATE TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Delete scheduled_follow_ups" ON public.scheduled_follow_ups FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- outreach_queue
DROP POLICY IF EXISTS "Authenticated users can view outreach queue" ON public.outreach_queue;
DROP POLICY IF EXISTS "Authenticated users can insert outreach queue" ON public.outreach_queue;
DROP POLICY IF EXISTS "Authenticated users can update outreach queue" ON public.outreach_queue;
DROP POLICY IF EXISTS "Authenticated users can delete outreach queue" ON public.outreach_queue;
CREATE POLICY "View outreach_queue" ON public.outreach_queue FOR SELECT TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Insert outreach_queue" ON public.outreach_queue FOR INSERT TO authenticated WITH CHECK ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Update outreach_queue" ON public.outreach_queue FOR UPDATE TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Delete outreach_queue" ON public.outreach_queue FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- reply_intents
DROP POLICY IF EXISTS "Authenticated users can view reply_intents" ON public.reply_intents;
DROP POLICY IF EXISTS "Authenticated users can insert reply_intents" ON public.reply_intents;
DROP POLICY IF EXISTS "Authenticated users can update reply_intents" ON public.reply_intents;
DROP POLICY IF EXISTS "Authenticated users can delete reply_intents" ON public.reply_intents;
CREATE POLICY "View reply_intents" ON public.reply_intents FOR SELECT TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Insert reply_intents" ON public.reply_intents FOR INSERT TO authenticated WITH CHECK ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Update reply_intents" ON public.reply_intents FOR UPDATE TO authenticated USING ((prospect_id IS NULL AND public.is_admin(auth.uid())) OR public.can_access_prospect(prospect_id));
CREATE POLICY "Delete reply_intents" ON public.reply_intents FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- conversions
DROP POLICY IF EXISTS "Authenticated users can view conversions" ON public.conversions;
DROP POLICY IF EXISTS "Authenticated users can insert conversions" ON public.conversions;
DROP POLICY IF EXISTS "Authenticated users can update conversions" ON public.conversions;
DROP POLICY IF EXISTS "Authenticated users can delete conversions" ON public.conversions;
CREATE POLICY "View conversions via prospect" ON public.conversions FOR SELECT TO authenticated USING (public.can_access_prospect(prospect_id));
CREATE POLICY "Insert conversions via prospect" ON public.conversions FOR INSERT TO authenticated WITH CHECK (public.can_access_prospect(prospect_id));
CREATE POLICY "Update conversions via prospect" ON public.conversions FOR UPDATE TO authenticated USING (public.can_access_prospect(prospect_id));
CREATE POLICY "Delete conversions via prospect" ON public.conversions FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- email_events
DROP POLICY IF EXISTS "Authenticated users can view email_events" ON public.email_events;
DROP POLICY IF EXISTS "Authenticated users can insert email_events" ON public.email_events;
CREATE POLICY "View email_events" ON public.email_events FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.sent_emails se WHERE se.id = sent_email_id AND public.can_access_prospect(se.prospect_id)
  )
);
CREATE POLICY "Insert email_events" ON public.email_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- agent_runs / agent_settings: admin-only writes
DROP POLICY IF EXISTS "Authenticated users can insert agent_runs" ON public.agent_runs;
DROP POLICY IF EXISTS "Authenticated users can update agent_runs" ON public.agent_runs;
CREATE POLICY "Admins can insert agent_runs" ON public.agent_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update agent_runs" ON public.agent_runs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert agent_settings" ON public.agent_settings;
DROP POLICY IF EXISTS "Authenticated users can update agent_settings" ON public.agent_settings;
CREATE POLICY "Admins can insert agent_settings" ON public.agent_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update agent_settings" ON public.agent_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- email_templates
DROP POLICY IF EXISTS "Authenticated users can insert email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete email_templates" ON public.email_templates;
CREATE POLICY "Admins can insert email_templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update email_templates" ON public.email_templates FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete email_templates" ON public.email_templates FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- sms_templates
DROP POLICY IF EXISTS "Authenticated users can insert sms_templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Authenticated users can update sms_templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Authenticated users can delete sms_templates" ON public.sms_templates;
CREATE POLICY "Admins can insert sms_templates" ON public.sms_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update sms_templates" ON public.sms_templates FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete sms_templates" ON public.sms_templates FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- follow_up_rules
DROP POLICY IF EXISTS "Authenticated users can insert follow_up_rules" ON public.follow_up_rules;
DROP POLICY IF EXISTS "Authenticated users can update follow_up_rules" ON public.follow_up_rules;
DROP POLICY IF EXISTS "Authenticated users can delete follow_up_rules" ON public.follow_up_rules;
CREATE POLICY "Admins can insert follow_up_rules" ON public.follow_up_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update follow_up_rules" ON public.follow_up_rules FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete follow_up_rules" ON public.follow_up_rules FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
