
-- 1) Add subtitles JSONB column to movies + episodes (array of { lang, label, path })
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS subtitles jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS subtitles jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Storage policies for the private "subtitles" bucket
-- Any authenticated viewer can read subtitle files (needed for playback via signed URLs).
DROP POLICY IF EXISTS "Authenticated can read subtitles" ON storage.objects;
CREATE POLICY "Authenticated can read subtitles"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'subtitles');

-- Only admins can upload / update / delete subtitle files.
DROP POLICY IF EXISTS "Admins can upload subtitles" ON storage.objects;
CREATE POLICY "Admins can upload subtitles"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'subtitles' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update subtitles" ON storage.objects;
CREATE POLICY "Admins can update subtitles"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'subtitles' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'subtitles' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete subtitles" ON storage.objects;
CREATE POLICY "Admins can delete subtitles"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'subtitles' AND public.has_role(auth.uid(), 'admin'));
