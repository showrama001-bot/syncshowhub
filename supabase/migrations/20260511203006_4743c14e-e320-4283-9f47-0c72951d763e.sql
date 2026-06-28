
CREATE TABLE public.trailers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  movie_title text NOT NULL,
  voe_sx_url text,
  doodstream_url text,
  streamtape_url text,
  youtube_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX trailers_movie_id_unique ON public.trailers(movie_id);
CREATE INDEX trailers_movie_title_idx ON public.trailers(lower(movie_title));

ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trailers readable" ON public.trailers FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write trailers" ON public.trailers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trailers_touch_updated_at BEFORE UPDATE ON public.trailers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
