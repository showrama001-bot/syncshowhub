
CREATE SCHEMA IF NOT EXISTS private;

-- get_my_ban_status
CREATE OR REPLACE FUNCTION private.get_my_ban_status()
RETURNS TABLE(is_banned boolean, suspended_until timestamptz, permanent_banned boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.is_banned, p.suspended_until, p.permanent_banned
  FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_ban_status()
RETURNS TABLE(is_banned boolean, suspended_until timestamptz, permanent_banned boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT * FROM private.get_my_ban_status() $$;

-- admin_count_banned
CREATE OR REPLACE FUNCTION private.admin_count_banned()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN private.has_role(auth.uid(), 'admin'::app_role)
              THEN (SELECT count(*)::int FROM public.profiles WHERE is_banned = true)
              ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.admin_count_banned()
RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.admin_count_banned() $$;

-- admin_get_ban_status
CREATE OR REPLACE FUNCTION private.admin_get_ban_status(_ids uuid[])
RETURNS TABLE(id uuid, is_banned boolean, suspended_until timestamptz, permanent_banned boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.is_banned, p.suspended_until, p.permanent_banned
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role) AND p.id = ANY(_ids);
$$;

CREATE OR REPLACE FUNCTION public.admin_get_ban_status(_ids uuid[])
RETURNS TABLE(id uuid, is_banned boolean, suspended_until timestamptz, permanent_banned boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT * FROM private.admin_get_ban_status(_ids) $$;

REVOKE EXECUTE ON FUNCTION private.get_my_ban_status(), private.admin_count_banned(), private.admin_get_ban_status(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_ban_status(), public.admin_count_banned(), public.admin_get_ban_status(uuid[]) TO authenticated;
