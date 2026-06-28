
-- Series table
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  poster_url text,
  backdrop_url text,
  genre text,
  category text,
  year integer,
  tmdb_id integer,
  imdb_rating numeric,
  featured boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series readable" ON public.series FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write series" ON public.series FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_touch_series BEFORE UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seasons
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, season_number)
);
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons readable" ON public.seasons FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write seasons" ON public.seasons FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

-- Episodes
CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  episode_number integer NOT NULL,
  title text NOT NULL,
  voe_sx_url text,
  doodstream_url text,
  streamtape_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, episode_number)
);
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes readable" ON public.episodes FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write episodes" ON public.episodes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

-- Trailers: support movie OR series, plus a 'kind' tag
ALTER TABLE public.trailers ALTER COLUMN movie_id DROP NOT NULL;
ALTER TABLE public.trailers ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.series(id) ON DELETE CASCADE;
ALTER TABLE public.trailers ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'movie';
