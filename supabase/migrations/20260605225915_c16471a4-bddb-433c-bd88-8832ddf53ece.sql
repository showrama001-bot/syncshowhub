-- Watch Together rooms
CREATE TABLE public.watch_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Watch Party',
  content_kind text NOT NULL DEFAULT 'movie',
  content_id uuid,
  content_title text,
  poster_url text,
  stream_url text,
  visibility text NOT NULL DEFAULT 'public',
  password_hash text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'live',
  participant_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.watch_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_rooms TO authenticated;
GRANT ALL ON public.watch_rooms TO service_role;

ALTER TABLE public.watch_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rooms"
ON public.watch_rooms FOR SELECT
USING (true);

CREATE POLICY "Authenticated can create rooms"
ON public.watch_rooms FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update own rooms"
ON public.watch_rooms FOR UPDATE
TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can delete own rooms"
ON public.watch_rooms FOR DELETE
TO authenticated
USING (auth.uid() = host_id);

CREATE TRIGGER trg_watch_rooms_updated_at
BEFORE UPDATE ON public.watch_rooms
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reminders
CREATE TABLE public.watch_room_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.watch_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_room_reminders TO authenticated;
GRANT ALL ON public.watch_room_reminders TO service_role;

ALTER TABLE public.watch_room_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
ON public.watch_room_reminders FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_room_reminders;
ALTER TABLE public.watch_rooms REPLICA IDENTITY FULL;