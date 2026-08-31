ALTER TABLE public.watchlist ALTER COLUMN movie_id DROP NOT NULL;
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE;
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'movie';
ALTER TABLE public.watchlist DROP CONSTRAINT IF EXISTS watchlist_one_target;
ALTER TABLE public.watchlist ADD CONSTRAINT watchlist_one_target CHECK ((movie_id IS NOT NULL) <> (episode_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_movie_uidx ON public.watchlist (user_id, movie_id) WHERE movie_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_episode_uidx ON public.watchlist (user_id, episode_id) WHERE episode_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;