
-- =========================================================================
-- 1) platform_settings: only signed-in users can read
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.platform_settings FROM anon;

-- =========================================================================
-- 2) watch_rooms: restrict SELECT to authenticated and hide password_hash
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.watch_rooms;
CREATE POLICY "Authenticated can view rooms"
  ON public.watch_rooms
  FOR SELECT
  TO authenticated
  USING (true);

-- Column-level SELECT: remove blanket SELECT and grant only non-sensitive columns
REVOKE SELECT ON public.watch_rooms FROM anon, authenticated, PUBLIC;
GRANT SELECT (
  id, host_id, title, content_kind, content_id, content_title,
  poster_url, stream_url, visibility, scheduled_at, status,
  participant_count, created_at, updated_at
) ON public.watch_rooms TO authenticated;
-- Preserve write access (already gated by RLS policies scoped to auth.uid() = host_id)
GRANT INSERT, UPDATE, DELETE ON public.watch_rooms TO authenticated;
GRANT ALL ON public.watch_rooms TO service_role;

-- =========================================================================
-- 3) Move SECURITY DEFINER logic to a private schema not exposed to the API.
--    Keep public.* wrappers as SECURITY INVOKER so existing policies and
--    client rpc() calls keep working, but the callable API-visible functions
--    are no longer SECURITY DEFINER.
-- =========================================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- has_role -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.has_role(_user_id, _role) $$;

-- is_blocked ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  )
$$;
REVOKE ALL ON FUNCTION private.is_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.is_blocked(_a, _b) $$;

-- is_device_banned ---------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_device_banned(_fp text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.device_bans WHERE device_fingerprint = _fp)
$$;
REVOKE ALL ON FUNCTION private.is_device_banned(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_device_banned(text) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.is_device_banned(_fp text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.is_device_banned(_fp) $$;

-- verify_watch_room_password ----------------------------------------------
CREATE OR REPLACE FUNCTION private.verify_watch_room_password(_room_id uuid, _password_hash text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.watch_rooms
    WHERE id = _room_id
      AND password_hash IS NOT NULL
      AND password_hash = _password_hash
  )
$$;
REVOKE ALL ON FUNCTION private.verify_watch_room_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.verify_watch_room_password(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_watch_room_password(_room_id uuid, _password_hash text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.verify_watch_room_password(_room_id, _password_hash) $$;

-- =========================================================================
-- 4) Trigger-only SECURITY DEFINER functions: revoke API-callable EXECUTE.
--    Triggers still fire regardless of EXECUTE grants on the trigger function.
-- =========================================================================
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
