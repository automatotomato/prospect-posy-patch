
-- Prevent privilege escalation: only admins can write user_roles
CREATE POLICY "Admins can insert user_roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update user_roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete user_roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Restrict team_members visibility to self or admins
DROP POLICY IF EXISTS "Authenticated users can view team_members" ON public.team_members;

CREATE POLICY "View own team_member or admin views all"
ON public.team_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
