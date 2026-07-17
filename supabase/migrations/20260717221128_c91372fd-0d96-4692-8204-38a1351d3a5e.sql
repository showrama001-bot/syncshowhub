
CREATE TABLE IF NOT EXISTS public.streamer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bio text NOT NULL,
  sample_link text,
  desired_username text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id uuid REFERENCES auth.users(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_streamer_app_pending
  ON public.streamer_applications(user_id) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE ON public.streamer_applications TO authenticated;
GRANT ALL ON public.streamer_applications TO service_role;
ALTER TABLE public.streamer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_read" ON public.streamer_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "app_insert" ON public.streamer_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "app_admin_update" ON public.streamer_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_streamer_apps_updated
  BEFORE UPDATE ON public.streamer_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- streamer_rooms
CREATE TABLE IF NOT EXISTS public.streamer_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username_slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Untitled stream',
  description text,
  is_live boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'offline' CHECK (mode IN ('offline','webrtc','upload')),
  current_video_url text,
  current_video_title text,
  current_poster text,
  viewer_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.streamer_rooms TO anon, authenticated;
GRANT INSERT, UPDATE ON public.streamer_rooms TO authenticated;
GRANT ALL ON public.streamer_rooms TO service_role;
ALTER TABLE public.streamer_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_public_read" ON public.streamer_rooms FOR SELECT USING (true);
CREATE POLICY "rooms_owner_insert" ON public.streamer_rooms FOR INSERT TO authenticated
  WITH CHECK (streamer_id = auth.uid() AND public.has_role(auth.uid(),'approved_streamer'));
CREATE POLICY "rooms_owner_update" ON public.streamer_rooms FOR UPDATE TO authenticated
  USING (streamer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (streamer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_streamer_rooms_updated
  BEFORE UPDATE ON public.streamer_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- room_chat_messages
CREATE TABLE IF NOT EXISTS public.room_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.streamer_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.room_chat_messages TO authenticated;
GRANT ALL ON public.room_chat_messages TO service_role;
ALTER TABLE public.room_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_read" ON public.room_chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_send" ON public.room_chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat_delete" ON public.room_chat_messages FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.streamer_rooms r WHERE r.id = room_id AND r.streamer_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_room_chat_room_created ON public.room_chat_messages(room_id, created_at DESC);

-- streamer_uploads
CREATE TABLE IF NOT EXISTS public.streamer_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  tmdb_id int,
  poster_url text,
  backdrop_url text,
  year int,
  genre text,
  overview text,
  rating numeric,
  stream_url text NOT NULL,
  telegram_file_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.streamer_uploads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.streamer_uploads TO authenticated;
GRANT ALL ON public.streamer_uploads TO service_role;
ALTER TABLE public.streamer_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uploads_public_read" ON public.streamer_uploads FOR SELECT USING (true);
CREATE POLICY "uploads_insert" ON public.streamer_uploads FOR INSERT TO authenticated
  WITH CHECK (streamer_id = auth.uid() AND (public.has_role(auth.uid(),'approved_streamer') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "uploads_update" ON public.streamer_uploads FOR UPDATE TO authenticated
  USING (streamer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (streamer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "uploads_delete" ON public.streamer_uploads FOR DELETE TO authenticated
  USING (streamer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_streamer_uploads_updated
  BEFORE UPDATE ON public.streamer_uploads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.streamer_rooms;

-- Approval trigger
CREATE OR REPLACE FUNCTION public.on_streamer_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slug text;
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.user_id, 'approved_streamer'::app_role)
    ON CONFLICT DO NOTHING;
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'pending_streamer'::app_role;
    slug := lower(regexp_replace(NEW.desired_username, '[^a-zA-Z0-9_-]+', '-', 'g'));
    IF slug = '' THEN slug := 'streamer-' || substr(NEW.user_id::text, 1, 8); END IF;
    INSERT INTO public.streamer_rooms (streamer_id, username_slug, title)
    VALUES (NEW.user_id, slug, NEW.desired_username || ' live')
    ON CONFLICT (streamer_id) DO NOTHING;
  ELSIF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.user_id, 'pending_streamer'::app_role)
    ON CONFLICT DO NOTHING;
  ELSIF NEW.status = 'rejected' THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'pending_streamer'::app_role;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.on_streamer_application_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_streamer_app_status ON public.streamer_applications;
CREATE TRIGGER trg_streamer_app_status
  AFTER INSERT OR UPDATE OF status ON public.streamer_applications
  FOR EACH ROW EXECUTE FUNCTION public.on_streamer_application_status_change();
