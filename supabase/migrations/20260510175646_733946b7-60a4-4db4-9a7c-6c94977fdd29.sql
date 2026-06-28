DROP POLICY IF EXISTS "view own roles" ON public.user_roles;
CREATE POLICY "view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;