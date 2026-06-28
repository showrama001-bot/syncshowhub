
CREATE TABLE public.community_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id integer,
  title text NOT NULL,
  description text,
  poster_url text,
  backdrop_url text,
  year integer,
  genre text,
  category text,
  duration_minutes integer,
  rating numeric,
  imdb_rating numeric,
  stream_url text NOT NULL,
  telegram_file_id text,
  source_type text DEFAULT 'mp4',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text,
  reviewed_at timestamptz,
  published_movie_id uuid REFERENCES public.movies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_uploads TO authenticated;
GRANT ALL ON public.community_uploads TO service_role;

ALTER TABLE public.community_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own uploads"
  ON public.community_uploads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Users view their own uploads"
  ON public.community_uploads FOR SELECT TO authenticated
  USING (auth.uid() = uploader_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update any upload"
  ON public.community_uploads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any upload"
  ON public.community_uploads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER community_uploads_touch_updated
  BEFORE UPDATE ON public.community_uploads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX community_uploads_status_idx ON public.community_uploads(status, created_at DESC);
CREATE INDEX community_uploads_uploader_idx ON public.community_uploads(uploader_id, created_at DESC);
