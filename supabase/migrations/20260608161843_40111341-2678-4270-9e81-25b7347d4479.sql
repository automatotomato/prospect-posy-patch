
-- 1. sales_leads table
CREATE TABLE public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  website text,
  email text,
  phone text,
  city text,
  state text,
  industry text,
  source text,
  notes text,
  email_subject text,
  email_body text,
  email_generated_at timestamptz,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_leads TO authenticated;
GRANT ALL ON public.sales_leads TO service_role;

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their leads"
  ON public.sales_leads FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners can insert their leads"
  ON public.sales_leads FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their leads"
  ON public.sales_leads FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners can delete their leads"
  ON public.sales_leads FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER sales_leads_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sales_leads_owner ON public.sales_leads(owner_id);
CREATE INDEX idx_sales_leads_status ON public.sales_leads(status);

-- 2. Allow management user
INSERT INTO public.allowed_users (email, role, name)
VALUES ('management@z-cconsultants.com', 'admin', 'Z-C Consultants Management')
ON CONFLICT (email) DO UPDATE SET role = 'admin';
