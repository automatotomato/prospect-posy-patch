
CREATE TABLE public.sales_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  deal_notes text,
  won_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_wins TO authenticated;
GRANT ALL ON public.sales_wins TO service_role;

ALTER TABLE public.sales_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wins_select_admin_or_owner" ON public.sales_wins FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR closed_by = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "wins_insert_self" ON public.sales_wins FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR closed_by = auth.uid());

CREATE POLICY "wins_update_admin_or_self" ON public.sales_wins FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR closed_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR closed_by = auth.uid());

CREATE POLICY "wins_delete_admin" ON public.sales_wins FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER sales_wins_updated_at BEFORE UPDATE ON public.sales_wins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
