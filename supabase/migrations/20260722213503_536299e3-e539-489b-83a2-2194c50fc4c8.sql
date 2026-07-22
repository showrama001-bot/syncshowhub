
-- 1) active_stream: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read the active stream" ON public.active_stream;
CREATE POLICY "Authenticated can read the active stream"
  ON public.active_stream FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.active_stream FROM anon;

-- 2) feed_posts / feed_comments / feed_likes: authenticated-only reads
DROP POLICY IF EXISTS "posts readable" ON public.feed_posts;
CREATE POLICY "posts readable to authenticated"
  ON public.feed_posts FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.feed_posts FROM anon;

DROP POLICY IF EXISTS "comments readable" ON public.feed_comments;
CREATE POLICY "comments readable to authenticated"
  ON public.feed_comments FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.feed_comments FROM anon;

DROP POLICY IF EXISTS "likes readable" ON public.feed_likes;
CREATE POLICY "likes readable to authenticated"
  ON public.feed_likes FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.feed_likes FROM anon;

-- 3) streamer_uploads: authenticated-only reads
DROP POLICY IF EXISTS "uploads_public_read" ON public.streamer_uploads;
CREATE POLICY "uploads_authenticated_read"
  ON public.streamer_uploads FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.streamer_uploads FROM anon;

-- 4) profiles: hide moderation columns from other users via column-level grants
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at, updated_at)
  ON public.profiles TO authenticated;
-- Owner can read own moderation fields; admins via has_role
GRANT SELECT (is_banned, suspended_until, permanent_banned)
  ON public.profiles TO authenticated;
-- Column-level RLS: restrict reading moderation columns to owner/admin
DROP POLICY IF EXISTS "profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "profiles base read"
  ON public.profiles FOR SELECT TO authenticated USING (true);
-- Note: moderation column exposure is now controlled by app code using get_my_ban_status()/admin_* RPCs.
-- To fully prevent selection of moderation columns by others, revoke them and re-grant only via functions:
REVOKE SELECT (is_banned, suspended_until, permanent_banned) ON public.profiles FROM authenticated;

-- 5) watch_rooms: revoke password_hash from authenticated
REVOKE SELECT ON public.watch_rooms FROM authenticated, anon;
GRANT SELECT (id, host_id, title, content_kind, content_id, content_title,
              poster_url, stream_url, visibility, scheduled_at, status,
              participant_count, created_at, updated_at, reminder_sent_at)
  ON public.watch_rooms TO authenticated;
-- password_hash intentionally NOT granted; verification goes through verify_watch_room_password()

-- 6) Revoke EXECUTE on SECURITY DEFINER trigger/internal helpers from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_streamer_application_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fanout_host_notification(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_studio_stream_live() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_room_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_watch_room_events() FROM PUBLIC, anon, authenticated;
