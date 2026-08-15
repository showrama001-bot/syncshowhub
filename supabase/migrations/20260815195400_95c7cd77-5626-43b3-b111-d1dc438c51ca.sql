CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level text NOT NULL DEFAULT 'error',
  area text NOT NULL DEFAULT 'app',
  source text NOT NULL DEFAULT 'window',
  message text NOT NULL,
  stack text,
  route text,
  user_agent text,
  status_code int,
  request_url text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid
);

CREATE INDEX IF NOT EXISTS client_error_logs_created_idx ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS client_error_logs_area_idx ON public.client_error_logs (area);
CREATE INDEX IF NOT EXISTS client_error_logs_fingerprint_idx ON public.client_error_logs (fingerprint);

GRANT INSERT ON public.client_error_logs TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.client_error_logs TO authenticated;
GRANT ALL ON public.client_error_logs TO service_role;

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cel_insert ON public.client_error_logs;
CREATE POLICY cel_insert ON public.client_error_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS cel_admin_read ON public.client_error_logs;
CREATE POLICY cel_admin_read ON public.client_error_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS cel_admin_update ON public.client_error_logs;
CREATE POLICY cel_admin_update ON public.client_error_logs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS cel_admin_delete ON public.client_error_logs;
CREATE POLICY cel_admin_delete ON public.client_error_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));