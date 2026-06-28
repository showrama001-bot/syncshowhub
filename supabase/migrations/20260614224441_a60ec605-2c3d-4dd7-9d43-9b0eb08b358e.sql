
-- 1. movies extensions
ALTER TABLE public.movies
  ALTER COLUMN stream_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS provider text;

CREATE INDEX IF NOT EXISTS movies_status_idx ON public.movies(status);

-- 2. votes
CREATE TABLE IF NOT EXISTS public.missing_stream_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movie_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.missing_stream_votes TO authenticated;
GRANT ALL ON public.missing_stream_votes TO service_role;
ALTER TABLE public.missing_stream_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes readable to authed"
  ON public.missing_stream_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own votes"
  ON public.missing_stream_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own votes"
  ON public.missing_stream_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. user-submitted streams
CREATE TABLE IF NOT EXISTS public.missing_stream_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missing_stream_submissions TO authenticated;
GRANT ALL ON public.missing_stream_submissions TO service_role;
ALTER TABLE public.missing_stream_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions readable to authed"
  ON public.missing_stream_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own submissions"
  ON public.missing_stream_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own submissions"
  ON public.missing_stream_submissions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage submissions"
  ON public.missing_stream_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER missing_stream_submissions_touch
  BEFORE UPDATE ON public.missing_stream_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
