CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'agent',
    'va'
);


--
-- Name: lead_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_source AS ENUM (
    'field_photo',
    'email',
    'referral',
    'website',
    'cold_call',
    'csv_import'
);


--
-- Name: prospect_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prospect_status AS ENUM (
    'new',
    'contacted',
    'qualified',
    'quoted',
    'closed'
);


--
-- Name: team_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.team_role AS ENUM (
    'agent',
    'va',
    'manager'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: agent_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_date date DEFAULT CURRENT_DATE NOT NULL,
    businesses_found integer DEFAULT 0,
    emails_generated integer DEFAULT 0,
    status text DEFAULT 'running'::text,
    search_location text,
    search_types text[],
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sent_email_id uuid,
    event_type text NOT NULL,
    event_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_ingestion_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_ingestion_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    from_email text NOT NULL,
    subject text,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    prospect_id uuid,
    status text DEFAULT 'processed'::text NOT NULL,
    error_message text
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    category text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: follow_up_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_up_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trigger_condition text NOT NULL,
    delay_hours integer DEFAULT 24 NOT NULL,
    email_template text NOT NULL,
    subject_template text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follow_up_rules_trigger_condition_check CHECK ((trigger_condition = ANY (ARRAY['opened_not_clicked'::text, 'not_opened'::text, 'clicked'::text, 'no_response'::text])))
);


--
-- Name: outreach_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid,
    to_email text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    email_type text DEFAULT 'outreach'::text,
    status text DEFAULT 'pending'::text,
    generated_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    sent_at timestamp with time zone,
    notes text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: prospect_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prospect_tasks_type_check CHECK ((type = ANY (ARRAY['call'::text, 'email'::text, 'text'::text, 'follow_up'::text])))
);


--
-- Name: prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_name text NOT NULL,
    contact_name text,
    phone text,
    email text,
    website text,
    location text NOT NULL,
    vehicle_count integer,
    vehicle_types text[],
    services text,
    notes text,
    status public.prospect_status DEFAULT 'new'::public.prospect_status NOT NULL,
    source public.lead_source DEFAULT 'email'::public.lead_source NOT NULL,
    assigned_to uuid,
    next_follow_up timestamp with time zone,
    moved_to_quoting boolean DEFAULT false NOT NULL,
    image_url text,
    raw_email_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    do_not_contact boolean DEFAULT false NOT NULL,
    do_not_contact_reason text
);


--
-- Name: scheduled_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    to_email text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    prospect_id uuid,
    email_type text,
    scheduled_for timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone
);


--
-- Name: scheduled_follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sent_email_id uuid NOT NULL,
    follow_up_rule_id uuid NOT NULL,
    prospect_id uuid,
    scheduled_for timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduled_follow_ups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'cancelled'::text, 'skipped'::text])))
);


--
-- Name: sent_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sent_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid,
    resend_id text,
    to_email text NOT NULL,
    subject text NOT NULL,
    email_type text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    open_count integer DEFAULT 0 NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    body text
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role public.team_role DEFAULT 'agent'::public.team_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'agent'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_runs agent_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_pkey PRIMARY KEY (id);


--
-- Name: agent_settings agent_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_pkey PRIMARY KEY (id);


--
-- Name: agent_settings agent_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: email_ingestion_log email_ingestion_log_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ingestion_log
    ADD CONSTRAINT email_ingestion_log_message_id_key UNIQUE (message_id);


--
-- Name: email_ingestion_log email_ingestion_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ingestion_log
    ADD CONSTRAINT email_ingestion_log_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: follow_up_rules follow_up_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_rules
    ADD CONSTRAINT follow_up_rules_pkey PRIMARY KEY (id);


--
-- Name: outreach_queue outreach_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_queue
    ADD CONSTRAINT outreach_queue_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: prospect_tasks prospect_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_tasks
    ADD CONSTRAINT prospect_tasks_pkey PRIMARY KEY (id);


--
-- Name: prospects prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);


--
-- Name: scheduled_emails scheduled_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_emails
    ADD CONSTRAINT scheduled_emails_pkey PRIMARY KEY (id);


--
-- Name: scheduled_follow_ups scheduled_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_follow_ups
    ADD CONSTRAINT scheduled_follow_ups_pkey PRIMARY KEY (id);


--
-- Name: scheduled_follow_ups scheduled_follow_ups_sent_email_id_follow_up_rule_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_follow_ups
    ADD CONSTRAINT scheduled_follow_ups_sent_email_id_follow_up_rule_id_key UNIQUE (sent_email_id, follow_up_rule_id);


--
-- Name: sent_emails sent_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_emails
    ADD CONSTRAINT sent_emails_pkey PRIMARY KEY (id);


--
-- Name: sent_emails sent_emails_resend_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_emails
    ADD CONSTRAINT sent_emails_resend_id_key UNIQUE (resend_id);


--
-- Name: team_members team_members_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_email_key UNIQUE (email);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_email_events_sent_email_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_events_sent_email_id ON public.email_events USING btree (sent_email_id);


--
-- Name: idx_scheduled_follow_ups_sent_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_follow_ups_sent_email ON public.scheduled_follow_ups USING btree (sent_email_id);


--
-- Name: idx_scheduled_follow_ups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_follow_ups_status ON public.scheduled_follow_ups USING btree (status, scheduled_for);


--
-- Name: idx_sent_emails_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_emails_prospect_id ON public.sent_emails USING btree (prospect_id);


--
-- Name: idx_sent_emails_resend_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sent_emails_resend_id ON public.sent_emails USING btree (resend_id);


--
-- Name: agent_settings update_agent_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_settings_updated_at BEFORE UPDATE ON public.agent_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: prospects update_prospects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_events email_events_sent_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_sent_email_id_fkey FOREIGN KEY (sent_email_id) REFERENCES public.sent_emails(id) ON DELETE CASCADE;


--
-- Name: email_ingestion_log email_ingestion_log_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ingestion_log
    ADD CONSTRAINT email_ingestion_log_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id);


--
-- Name: outreach_queue outreach_queue_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_queue
    ADD CONSTRAINT outreach_queue_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prospect_tasks prospect_tasks_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_tasks
    ADD CONSTRAINT prospect_tasks_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: prospects prospects_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.team_members(id);


--
-- Name: scheduled_emails scheduled_emails_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_emails
    ADD CONSTRAINT scheduled_emails_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE SET NULL;


--
-- Name: scheduled_follow_ups scheduled_follow_ups_follow_up_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_follow_ups
    ADD CONSTRAINT scheduled_follow_ups_follow_up_rule_id_fkey FOREIGN KEY (follow_up_rule_id) REFERENCES public.follow_up_rules(id) ON DELETE CASCADE;


--
-- Name: scheduled_follow_ups scheduled_follow_ups_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_follow_ups
    ADD CONSTRAINT scheduled_follow_ups_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE SET NULL;


--
-- Name: scheduled_follow_ups scheduled_follow_ups_sent_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_follow_ups
    ADD CONSTRAINT scheduled_follow_ups_sent_email_id_fkey FOREIGN KEY (sent_email_id) REFERENCES public.sent_emails(id) ON DELETE CASCADE;


--
-- Name: sent_emails sent_emails_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sent_emails
    ADD CONSTRAINT sent_emails_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: team_members Admins can delete team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete team_members" ON public.team_members FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: team_members Admins can insert team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert team_members" ON public.team_members FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: team_members Admins can update team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update team_members" ON public.team_members FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: email_ingestion_log Allow public access on email_ingestion_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public access on email_ingestion_log" ON public.email_ingestion_log USING (true);


--
-- Name: email_templates Allow public delete on email_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete on email_templates" ON public.email_templates FOR DELETE USING (true);


--
-- Name: follow_up_rules Allow public delete on follow_up_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete on follow_up_rules" ON public.follow_up_rules FOR DELETE USING (true);


--
-- Name: prospect_tasks Allow public delete on prospect_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete on prospect_tasks" ON public.prospect_tasks FOR DELETE USING (true);


--
-- Name: scheduled_emails Allow public delete on scheduled_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete on scheduled_emails" ON public.scheduled_emails FOR DELETE USING (true);


--
-- Name: email_events Allow public insert on email_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on email_events" ON public.email_events FOR INSERT WITH CHECK (true);


--
-- Name: email_templates Allow public insert on email_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on email_templates" ON public.email_templates FOR INSERT WITH CHECK (true);


--
-- Name: follow_up_rules Allow public insert on follow_up_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on follow_up_rules" ON public.follow_up_rules FOR INSERT WITH CHECK (true);


--
-- Name: prospect_tasks Allow public insert on prospect_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on prospect_tasks" ON public.prospect_tasks FOR INSERT WITH CHECK (true);


--
-- Name: scheduled_emails Allow public insert on scheduled_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on scheduled_emails" ON public.scheduled_emails FOR INSERT WITH CHECK (true);


--
-- Name: scheduled_follow_ups Allow public insert on scheduled_follow_ups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on scheduled_follow_ups" ON public.scheduled_follow_ups FOR INSERT WITH CHECK (true);


--
-- Name: sent_emails Allow public insert on sent_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on sent_emails" ON public.sent_emails FOR INSERT WITH CHECK (true);


--
-- Name: email_events Allow public read on email_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on email_events" ON public.email_events FOR SELECT USING (true);


--
-- Name: email_templates Allow public read on email_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on email_templates" ON public.email_templates FOR SELECT USING (true);


--
-- Name: follow_up_rules Allow public read on follow_up_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on follow_up_rules" ON public.follow_up_rules FOR SELECT USING (true);


--
-- Name: prospect_tasks Allow public read on prospect_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on prospect_tasks" ON public.prospect_tasks FOR SELECT USING (true);


--
-- Name: scheduled_emails Allow public read on scheduled_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on scheduled_emails" ON public.scheduled_emails FOR SELECT USING (true);


--
-- Name: scheduled_follow_ups Allow public read on scheduled_follow_ups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on scheduled_follow_ups" ON public.scheduled_follow_ups FOR SELECT USING (true);


--
-- Name: sent_emails Allow public read on sent_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on sent_emails" ON public.sent_emails FOR SELECT USING (true);


--
-- Name: email_templates Allow public update on email_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on email_templates" ON public.email_templates FOR UPDATE USING (true);


--
-- Name: follow_up_rules Allow public update on follow_up_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on follow_up_rules" ON public.follow_up_rules FOR UPDATE USING (true);


--
-- Name: prospect_tasks Allow public update on prospect_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on prospect_tasks" ON public.prospect_tasks FOR UPDATE USING (true);


--
-- Name: scheduled_emails Allow public update on scheduled_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on scheduled_emails" ON public.scheduled_emails FOR UPDATE USING (true);


--
-- Name: scheduled_follow_ups Allow public update on scheduled_follow_ups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on scheduled_follow_ups" ON public.scheduled_follow_ups FOR UPDATE USING (true);


--
-- Name: sent_emails Allow public update on sent_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on sent_emails" ON public.sent_emails FOR UPDATE USING (true);


--
-- Name: prospects Authenticated users can delete prospects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete prospects" ON public.prospects FOR DELETE TO authenticated USING (true);


--
-- Name: agent_settings Authenticated users can insert agent settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert agent settings" ON public.agent_settings FOR INSERT WITH CHECK (true);


--
-- Name: prospects Authenticated users can insert prospects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert prospects" ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: agent_settings Authenticated users can update agent settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update agent settings" ON public.agent_settings FOR UPDATE USING (true);


--
-- Name: prospects Authenticated users can update prospects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update prospects" ON public.prospects FOR UPDATE TO authenticated USING (true);


--
-- Name: agent_settings Authenticated users can view agent settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view agent settings" ON public.agent_settings FOR SELECT USING (true);


--
-- Name: prospects Authenticated users can view prospects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view prospects" ON public.prospects FOR SELECT TO authenticated USING (true);


--
-- Name: team_members Authenticated users can view team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view team_members" ON public.team_members FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Profiles are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: outreach_queue Users can delete from outreach queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete from outreach queue" ON public.outreach_queue FOR DELETE USING (true);


--
-- Name: agent_runs Users can insert agent runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert agent runs" ON public.agent_runs FOR INSERT WITH CHECK (true);


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: outreach_queue Users can insert to outreach queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert to outreach queue" ON public.outreach_queue FOR INSERT WITH CHECK (true);


--
-- Name: agent_runs Users can update agent runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update agent runs" ON public.agent_runs FOR UPDATE USING (true);


--
-- Name: outreach_queue Users can update outreach queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update outreach queue" ON public.outreach_queue FOR UPDATE USING (true);


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: agent_runs Users can view agent runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view agent runs" ON public.agent_runs FOR SELECT USING (true);


--
-- Name: outreach_queue Users can view outreach queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view outreach queue" ON public.outreach_queue FOR SELECT USING (true);


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: agent_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: email_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_ingestion_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_up_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follow_up_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: outreach_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outreach_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: prospect_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospect_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: prospects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_follow_ups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_follow_ups ENABLE ROW LEVEL SECURITY;

--
-- Name: sent_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;