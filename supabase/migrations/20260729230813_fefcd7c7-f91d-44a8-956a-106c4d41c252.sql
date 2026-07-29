-- 1) PROFILES: keep public columns readable, hide moderation fields
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at, updated_at, favorite_genres, favorite_movie)
  ON public.profiles TO authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at, updated_at, favorite_genres, favorite_movie)
  ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "profiles base read" ON public.profiles;
CREATE POLICY "profiles base read" ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- 2) WATCH ROOMS: never expose password_hash; restrict rows
REVOKE SELECT ON public.watch_rooms FROM anon, authenticated;
GRANT SELECT (id, host_id, title, content_kind, content_id, content_title, poster_url,
              stream_url, visibility, scheduled_at, status, participant_count,
              created_at, updated_at, reminder_sent_at)
  ON public.watch_rooms TO authenticated;
GRANT ALL ON public.watch_rooms TO service_role;

CREATE OR REPLACE FUNCTION private.can_view_watch_room(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.watch_rooms wr
    WHERE wr.id = _room_id
      AND (
        wr.visibility <> 'private'
        OR wr.host_id = _user_id
        OR EXISTS (SELECT 1 FROM public.room_invites ri WHERE ri.room_id = wr.id AND ri.to_user = _user_id)
      )
  )
$$;
REVOKE ALL ON FUNCTION private.can_view_watch_room(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can view rooms" ON public.watch_rooms;
CREATE POLICY "Authenticated can view rooms" ON public.watch_rooms
FOR SELECT TO authenticated
USING (
  visibility <> 'private'
  OR host_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.room_invites ri WHERE ri.room_id = watch_rooms.id AND ri.to_user = auth.uid())
  OR private.has_role(auth.uid(), 'admin'::app_role)
);

-- 3) ROOM CHAT: only room participants can read
DROP POLICY IF EXISTS chat_read ON public.room_chat_messages;
CREATE POLICY chat_read ON public.room_chat_messages
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.can_view_watch_room(room_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.streamer_rooms sr WHERE sr.id = room_chat_messages.room_id)
);

-- 4) STREAMER ROOMS: signed-in members only
DROP POLICY IF EXISTS rooms_public_read ON public.streamer_rooms;
CREATE POLICY rooms_public_read ON public.streamer_rooms
FOR SELECT TO authenticated
USING (true);
REVOKE SELECT ON public.streamer_rooms FROM anon;
GRANT SELECT ON public.streamer_rooms TO authenticated;
GRANT ALL ON public.streamer_rooms TO service_role;