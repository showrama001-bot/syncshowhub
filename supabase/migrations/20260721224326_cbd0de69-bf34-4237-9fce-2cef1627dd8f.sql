
-- Extensions for scheduled reminders
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================================
-- host_follows
-- =========================================================
CREATE TABLE public.host_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, host_id),
  CHECK (follower_id <> host_id)
);
CREATE INDEX host_follows_host_idx ON public.host_follows(host_id);
CREATE INDEX host_follows_follower_idx ON public.host_follows(follower_id);

GRANT SELECT, INSERT, DELETE ON public.host_follows TO authenticated;
GRANT ALL ON public.host_follows TO service_role;

ALTER TABLE public.host_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or as host" ON public.host_follows
  FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = host_id);

CREATE POLICY "follow self" ON public.host_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "unfollow self" ON public.host_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- =========================================================
-- notifications
-- =========================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  href text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.host_follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================================================
-- watch_rooms: reminder tracking column
-- =========================================================
ALTER TABLE public.watch_rooms
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- =========================================================
-- Fan-out helper: insert a notification for every follower of a host
-- =========================================================
CREATE OR REPLACE FUNCTION public.fanout_host_notification(
  _host uuid, _kind text, _title text, _href text, _meta jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, kind, title, href, meta)
  SELECT hf.follower_id, _kind, _title, _href, COALESCE(_meta, '{}'::jsonb)
  FROM public.host_follows hf
  WHERE hf.host_id = _host;
$$;

-- =========================================================
-- Trigger: watch_rooms lifecycle -> followers
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_watch_room_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host_name text;
BEGIN
  SELECT COALESCE(display_name, username, 'A host') INTO host_name
  FROM public.profiles WHERE id = NEW.host_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.scheduled_at IS NOT NULL AND NEW.status = 'scheduled' THEN
      PERFORM public.fanout_host_notification(
        NEW.host_id, 'room_scheduled',
        host_name || ' scheduled "' || COALESCE(NEW.title, 'a room') || '"',
        '/watch/' || NEW.id::text,
        jsonb_build_object('room_id', NEW.id, 'scheduled_at', NEW.scheduled_at)
      );
    ELSIF NEW.status = 'live' THEN
      PERFORM public.fanout_host_notification(
        NEW.host_id, 'room_live',
        host_name || ' is live: "' || COALESCE(NEW.title, 'a room') || '"',
        '/watch/' || NEW.id::text,
        jsonb_build_object('room_id', NEW.id)
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       AND NEW.scheduled_at IS NOT NULL
       AND NEW.status = 'scheduled' THEN
      NEW.reminder_sent_at := NULL;
      PERFORM public.fanout_host_notification(
        NEW.host_id, 'room_time_updated',
        'Time updated for "' || COALESCE(NEW.title, 'a room') || '"',
        '/watch/' || NEW.id::text,
        jsonb_build_object('room_id', NEW.id, 'scheduled_at', NEW.scheduled_at)
      );
    END IF;
    IF NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live' THEN
      PERFORM public.fanout_host_notification(
        NEW.host_id, 'room_live',
        host_name || ' is live: "' || COALESCE(NEW.title, 'a room') || '"',
        '/watch/' || NEW.id::text,
        jsonb_build_object('room_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_watch_room_events ON public.watch_rooms;
CREATE TRIGGER trg_notify_watch_room_events
  BEFORE INSERT OR UPDATE ON public.watch_rooms
  FOR EACH ROW EXECUTE FUNCTION public.notify_watch_room_events();

-- =========================================================
-- Trigger: studio_streams going live -> followers
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_studio_stream_live()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host_name text;
BEGIN
  IF NEW.status = 'live'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'live') THEN
    SELECT COALESCE(display_name, username, 'A host') INTO host_name
    FROM public.profiles WHERE id = NEW.host_id;
    PERFORM public.fanout_host_notification(
      NEW.host_id, 'studio_live',
      host_name || ' just went live: "' || COALESCE(NEW.title, 'Studio') || '"',
      '/live-stream?stream=' || NEW.id::text,
      jsonb_build_object('stream_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_studio_stream_live ON public.studio_streams;
CREATE TRIGGER trg_notify_studio_stream_live
  AFTER INSERT OR UPDATE ON public.studio_streams
  FOR EACH ROW EXECUTE FUNCTION public.notify_studio_stream_live();

-- =========================================================
-- Reminder job: send 10-minute-before reminders
-- =========================================================
CREATE OR REPLACE FUNCTION public.dispatch_room_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  host_name text;
BEGIN
  FOR r IN
    SELECT id, host_id, title, scheduled_at
    FROM public.watch_rooms
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND reminder_sent_at IS NULL
      AND scheduled_at BETWEEN now() AND now() + interval '10 minutes'
  LOOP
    SELECT COALESCE(display_name, username, 'A host') INTO host_name
    FROM public.profiles WHERE id = r.host_id;
    PERFORM public.fanout_host_notification(
      r.host_id, 'room_reminder',
      'Starting soon: "' || COALESCE(r.title, 'a room') || '" by ' || host_name,
      '/watch/' || r.id::text,
      jsonb_build_object('room_id', r.id, 'scheduled_at', r.scheduled_at)
    );
    UPDATE public.watch_rooms SET reminder_sent_at = now() WHERE id = r.id;
  END LOOP;
END;
$$;

-- Schedule the reminder dispatcher every minute (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-room-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-room-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-room-reminders',
  '* * * * *',
  $$ SELECT public.dispatch_room_reminders(); $$
);
