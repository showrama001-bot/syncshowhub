
-- 1) Restrict episodes SELECT to authenticated only
DROP POLICY IF EXISTS "episodes readable" ON public.episodes;
CREATE POLICY "episodes readable"
ON public.episodes
FOR SELECT
TO authenticated
USING (true);

-- 2) Restrict reels SELECT to authenticated only
DROP POLICY IF EXISTS "reels readable" ON public.reels;
CREATE POLICY "reels readable"
ON public.reels
FOR SELECT
TO authenticated
USING (true);

-- 3) Column-level restriction on profiles moderation fields.
-- Revoke blanket SELECT and re-grant only non-sensitive columns.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at, updated_at)
  ON public.profiles TO anon, authenticated;
-- Ensure admin update path via existing policy still works: UPDATE grant is unchanged.
-- service_role keeps full access.
GRANT ALL ON public.profiles TO service_role;

-- 4) SECURITY DEFINER function for user to check own ban status
CREATE OR REPLACE FUNCTION public.get_my_ban_status()
RETURNS TABLE(is_banned boolean, suspended_until timestamptz, permanent_banned boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.is_banned, p.suspended_until, p.permanent_banned
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_ban_status() TO authenticated;

-- 5) SECURITY DEFINER function for admins to fetch ban status for many users
CREATE OR REPLACE FUNCTION public.admin_get_ban_status(_ids uuid[])
RETURNS TABLE(id uuid, is_banned boolean, suspended_until timestamptz, permanent_banned boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.is_banned, p.suspended_until, p.permanent_banned
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
    AND p.id = ANY(_ids);
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_ban_status(uuid[]) TO authenticated;

-- 6) Admin banned count helper
CREATE OR REPLACE FUNCTION public.admin_count_banned()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN private.has_role(auth.uid(), 'admin'::app_role)
              THEN (SELECT count(*)::int FROM public.profiles WHERE is_banned = true)
              ELSE 0 END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_count_banned() TO authenticated;
