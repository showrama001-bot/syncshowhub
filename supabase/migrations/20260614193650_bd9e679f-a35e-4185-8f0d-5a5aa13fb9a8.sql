
CREATE TABLE public.playback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_kind TEXT NOT NULL CHECK (content_kind IN ('movie','episode','tv','match')),
  content_id UUID NOT NULL,
  content_title TEXT,
  issue TEXT NOT NULL CHECK (issue IN ('not_loading','broken_link','wrong_subtitles','audio_sync','other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','fixed','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

CREATE INDEX playback_reports_status_idx ON public.playback_reports(status, created_at DESC);
CREATE INDEX playback_reports_content_idx ON public.playback_reports(content_kind, content_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playback_reports TO authenticated;
GRANT ALL ON public.playback_reports TO service_role;

ALTER TABLE public.playback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own playback reports"
ON public.playback_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users see their own playback reports"
ON public.playback_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id);

CREATE POLICY "Admins see all playback reports"
ON public.playback_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update playback reports"
ON public.playback_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete playback reports"
ON public.playback_reports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
