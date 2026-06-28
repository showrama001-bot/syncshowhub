
-- 1. Extend movies
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS is_admin_upload BOOLEAN NOT NULL DEFAULT false;
UPDATE public.movies SET is_admin_upload = true WHERE created_at < now();

-- 2. Extend profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permanent_banned BOOLEAN NOT NULL DEFAULT false;

-- 3. movie_reports
CREATE TABLE public.movie_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate','wrong_video')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL
);

GRANT SELECT, INSERT, UPDATE ON public.movie_reports TO authenticated;
GRANT ALL ON public.movie_reports TO service_role;

ALTER TABLE public.movie_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporters insert own reports" ON public.movie_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reporters view own reports" ON public.movie_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins update reports" ON public.movie_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. user_violations
CREATE TABLE public.user_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  movie_id UUID NULL,
  report_id UUID NULL REFERENCES public.movie_reports(id) ON DELETE SET NULL,
  action_taken TEXT NOT NULL CHECK (action_taken IN ('movie_deleted','suspended_3d','permanent_ban')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL
);

GRANT SELECT ON public.user_violations TO authenticated;
GRANT ALL ON public.user_violations TO service_role;

ALTER TABLE public.user_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own violations" ON public.user_violations
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins manage violations" ON public.user_violations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. device_bans
CREATE TABLE public.device_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  device_fingerprint TEXT NOT NULL UNIQUE,
  ip_address TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL
);

GRANT SELECT ON public.device_bans TO anon, authenticated;
GRANT ALL ON public.device_bans TO service_role;

ALTER TABLE public.device_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device bans readable" ON public.device_bans
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admins manage device bans" ON public.device_bans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
