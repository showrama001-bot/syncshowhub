
ALTER TABLE public.community_uploads
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'movie',
  ADD COLUMN IF NOT EXISTS series_tmdb_id integer,
  ADD COLUMN IF NOT EXISTS season_number integer,
  ADD COLUMN IF NOT EXISTS episode_number integer,
  ADD COLUMN IF NOT EXISTS episode_title text,
  ADD COLUMN IF NOT EXISTS published_episode_id uuid;

ALTER TABLE public.community_uploads
  DROP CONSTRAINT IF EXISTS community_uploads_kind_check;
ALTER TABLE public.community_uploads
  ADD CONSTRAINT community_uploads_kind_check CHECK (kind IN ('movie','episode'));

-- Make stream_url nullable (some users may submit only metadata, but keep
-- the column for backwards compatibility). Existing rows already have a value.
ALTER TABLE public.community_uploads ALTER COLUMN stream_url DROP NOT NULL;

-- Fast lookup of the latest contributed episode for a given series.
CREATE INDEX IF NOT EXISTS community_uploads_series_seq_idx
  ON public.community_uploads (series_tmdb_id, season_number DESC, episode_number DESC)
  WHERE kind = 'episode';

-- Prevent duplicate active submissions of the same episode.
CREATE UNIQUE INDEX IF NOT EXISTS community_uploads_episode_uniq
  ON public.community_uploads (series_tmdb_id, season_number, episode_number)
  WHERE kind = 'episode' AND status IN ('pending','approved');
