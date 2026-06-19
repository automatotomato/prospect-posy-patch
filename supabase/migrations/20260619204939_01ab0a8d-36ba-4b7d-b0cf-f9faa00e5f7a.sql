
-- Fix 1: Restrict agent_settings SELECT to admins (contains sensitive config)
DROP POLICY IF EXISTS "Authenticated users can view agent_settings" ON public.agent_settings;
CREATE POLICY "Admins can view agent_settings"
  ON public.agent_settings FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Fix 2: Remove always-true UPDATE policies (SUPA_rls_policy_always_true)
-- Campaigns: restrict updates to creator or admin
DROP POLICY IF EXISTS "Authenticated users can update campaigns" ON public.campaigns;
CREATE POLICY "Creators or admins update campaigns"
  ON public.campaigns FOR UPDATE
  USING ((created_by = auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR public.is_admin(auth.uid()));

-- Clients: restrict updates to creator or admin
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
CREATE POLICY "Creators or admins update clients"
  ON public.clients FOR UPDATE
  USING ((created_by = auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR public.is_admin(auth.uid()));

-- Fix 3: Prevent ownership hijacking on sales_leads via a trigger
-- (WITH CHECK alone can't compare OLD vs NEW; use a BEFORE UPDATE trigger)
CREATE OR REPLACE FUNCTION public.prevent_sales_lead_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reassign lead ownership';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_sales_lead_owner_change ON public.sales_leads;
CREATE TRIGGER prevent_sales_lead_owner_change
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.prevent_sales_lead_owner_change();
