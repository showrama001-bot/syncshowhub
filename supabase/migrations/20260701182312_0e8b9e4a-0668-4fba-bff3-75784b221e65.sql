-- Dedupe existing titles before adding unique constraint
UPDATE public.watch_rooms w
SET title = w.title || ' #' || substr(w.id::text, 1, 6)
FROM (
  SELECT id, title, row_number() OVER (PARTITION BY title ORDER BY created_at) AS rn
  FROM public.watch_rooms
) d
WHERE w.id = d.id AND d.rn > 1;

ALTER TABLE public.watch_rooms ADD CONSTRAINT watch_rooms_title_unique UNIQUE (title);

CREATE TABLE public.room_kicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.watch_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kicked_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT ON public.room_kicks TO authenticated;
GRANT ALL ON public.room_kicks TO service_role;
ALTER TABLE public.room_kicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "host can kick" ON public.room_kicks FOR INSERT TO authenticated
  WITH CHECK (kicked_by = auth.uid() AND EXISTS (SELECT 1 FROM public.watch_rooms r WHERE r.id = room_id AND r.host_id = auth.uid()));
CREATE POLICY "read own or host kicks" ON public.room_kicks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR kicked_by = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_kicks;

CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT SELECT ON public.feed_posts TO anon;
GRANT ALL ON public.feed_posts TO service_role;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts readable" ON public.feed_posts FOR SELECT USING (true);
CREATE POLICY "own posts insert" ON public.feed_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own posts update" ON public.feed_posts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own posts delete" ON public.feed_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.feed_likes (
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.feed_likes TO authenticated;
GRANT SELECT ON public.feed_likes TO anon;
GRANT ALL ON public.feed_likes TO service_role;
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable" ON public.feed_likes FOR SELECT USING (true);
CREATE POLICY "own like insert" ON public.feed_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own like delete" ON public.feed_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.feed_comments TO authenticated;
GRANT SELECT ON public.feed_comments TO anon;
GRANT ALL ON public.feed_comments TO service_role;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable" ON public.feed_comments FOR SELECT USING (true);
CREATE POLICY "own comment insert" ON public.feed_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own comment delete" ON public.feed_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('trailer','upload')),
  youtube_id TEXT,
  video_url TEXT,
  movie_id UUID REFERENCES public.movies(id) ON DELETE SET NULL,
  title TEXT,
  poster_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reels TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.reels TO authenticated;
GRANT ALL ON public.reels TO service_role;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reels readable" ON public.reels FOR SELECT USING (true);
CREATE POLICY "admin manage reels" ON public.reels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));