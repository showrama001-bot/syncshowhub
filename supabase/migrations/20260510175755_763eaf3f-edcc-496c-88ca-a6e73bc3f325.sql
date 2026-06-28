CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write movies" ON public.movies;
CREATE POLICY "admins write movies"
ON public.movies
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write tv" ON public.tv_channels;
CREATE POLICY "admins write tv"
ON public.tv_channels
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write matches" ON public.matches;
CREATE POLICY "admins write matches"
ON public.matches
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update any profile" ON public.profiles;
CREATE POLICY "admins update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "delete own or admin comment" ON public.movie_comments;
CREATE POLICY "delete own or admin comment"
ON public.movie_comments
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "view own reports" ON public.reports;
CREATE POLICY "view own reports"
ON public.reports
FOR SELECT
TO authenticated
USING (reporter_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update reports" ON public.reports;
CREATE POLICY "admins update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));