
-- 1. permissions jsonb on allowed_users
ALTER TABLE public.allowed_users
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. assigned_to on sales_leads (auth user id)
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sales_leads_assigned_to_idx ON public.sales_leads(assigned_to);

-- Expand RLS so assignees can view/update their assigned leads
DROP POLICY IF EXISTS "Owners can view their leads" ON public.sales_leads;
DROP POLICY IF EXISTS "Owners can update their leads" ON public.sales_leads;

CREATE POLICY "View own or assigned leads" ON public.sales_leads
  FOR SELECT USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Update own or assigned leads" ON public.sales_leads
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_admin(auth.uid())
  ) WITH CHECK (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- 3. email_approvals table
CREATE TABLE IF NOT EXISTS public.email_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','sent')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_approvals TO authenticated;
GRANT ALL ON public.email_approvals TO service_role;

ALTER TABLE public.email_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters and admins can view approvals"
  ON public.email_approvals FOR SELECT
  USING (requested_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can request approvals"
  ON public.email_approvals FOR INSERT
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admins can update approvals"
  ON public.email_approvals FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete approvals"
  ON public.email_approvals FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS email_approvals_status_idx ON public.email_approvals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_approvals_requester_idx ON public.email_approvals(requested_by);

CREATE TRIGGER email_approvals_updated_at
  BEFORE UPDATE ON public.email_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
