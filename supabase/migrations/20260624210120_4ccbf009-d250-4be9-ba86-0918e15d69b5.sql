
-- 1. has_role: SECURITY DEFINER with fixed search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. device_bans: admin-only SELECT + RPC for self-check
DROP POLICY IF EXISTS "device bans readable" ON public.device_bans;
CREATE POLICY "admins read device bans" ON public.device_bans
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_device_banned(_fp text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.device_bans WHERE device_fingerprint = _fp)
$$;
GRANT EXECUTE ON FUNCTION public.is_device_banned(text) TO anon, authenticated;

-- 3. missing_stream_submissions: own + admin SELECT
DROP POLICY IF EXISTS "submissions readable to authed" ON public.missing_stream_submissions;
CREATE POLICY "users read own submissions" ON public.missing_stream_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4. watch_rooms: hide password_hash via column-level grants
REVOKE SELECT ON public.watch_rooms FROM anon, authenticated, PUBLIC;
GRANT SELECT (
  id, host_id, title, content_kind, content_id, content_title,
  poster_url, stream_url, visibility, scheduled_at, status,
  participant_count, created_at
) ON public.watch_rooms TO anon, authenticated;

-- Password verification RPC (definer)
CREATE OR REPLACE FUNCTION public.verify_watch_room_password(_room_id uuid, _password_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.watch_rooms
    WHERE id = _room_id
      AND password_hash IS NOT NULL
      AND password_hash = _password_hash
  )
$$;
GRANT EXECUTE ON FUNCTION public.verify_watch_room_password(uuid, text) TO authenticated;
