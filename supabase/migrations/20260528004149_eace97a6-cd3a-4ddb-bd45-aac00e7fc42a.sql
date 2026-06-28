CREATE TABLE public.server_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  server text NOT NULL CHECK (server IN ('voe','streamtape','doodstream')),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.server_reports TO authenticated;
GRANT ALL ON public.server_reports TO service_role;

ALTER TABLE public.server_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "create own server report" ON public.server_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "view own or admin server reports" ON public.server_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update server reports" ON public.server_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX server_reports_status_idx ON public.server_reports(status, created_at DESC);
CREATE INDEX server_reports_movie_idx ON public.server_reports(movie_id);