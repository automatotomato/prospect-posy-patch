
-- Replace insert policy with stricter check
DROP POLICY IF EXISTS "Owners can insert their leads" ON public.sales_leads;
CREATE POLICY "Owners can insert their leads"
ON public.sales_leads
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    owner_id = auth.uid()
    AND (assigned_to IS NULL OR assigned_to = auth.uid())
  )
);

-- Prevent non-admins from changing the assignee
CREATE OR REPLACE FUNCTION public.prevent_sales_lead_assignee_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change lead assignment';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_sales_lead_assignee_change_trg ON public.sales_leads;
CREATE TRIGGER prevent_sales_lead_assignee_change_trg
BEFORE UPDATE ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sales_lead_assignee_change();
