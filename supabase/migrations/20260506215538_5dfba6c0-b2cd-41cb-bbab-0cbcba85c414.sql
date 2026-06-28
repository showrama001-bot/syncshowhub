
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS tmdb_id integer,
  ADD COLUMN IF NOT EXISTS imdb_rating numeric,
  ADD COLUMN IF NOT EXISTS category text;

CREATE TABLE IF NOT EXISTS public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_id)
);
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own watchlist" ON public.watchlist
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "add to own watchlist" ON public.watchlist
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "remove from own watchlist" ON public.watchlist
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.movie_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  content text NOT NULL,
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 10)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.movie_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments readable" ON public.movie_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "post own comment" ON public.movie_comments
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_banned)
  );
CREATE POLICY "edit own comment" ON public.movie_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "delete own or admin comment" ON public.movie_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER movie_comments_touch
  BEFORE UPDATE ON public.movie_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
