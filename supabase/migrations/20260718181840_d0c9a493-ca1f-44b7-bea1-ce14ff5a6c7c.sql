
-- studio_streams
CREATE TABLE public.studio_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  title text NOT NULL,
  poster_url text,
  tmdb_id int,
  mode text NOT NULL DEFAULT 'obs',
  stream_url text,
  status text NOT NULL DEFAULT 'live',
  viewer_count int NOT NULL DEFAULT 0,
  ambient_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_streams TO authenticated;
GRANT ALL ON public.studio_streams TO service_role;
ALTER TABLE public.studio_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can view live streams or own"
  ON public.studio_streams FOR SELECT TO authenticated
  USING (status = 'live' OR host_id = auth.uid());

CREATE POLICY "host can insert own stream"
  ON public.studio_streams FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "host can update own stream"
  ON public.studio_streams FOR UPDATE TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

CREATE POLICY "host can delete own stream"
  ON public.studio_streams FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CREATE TRIGGER studio_streams_touch
  BEFORE UPDATE ON public.studio_streams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_streams;
ALTER TABLE public.studio_streams REPLICA IDENTITY FULL;

-- studio_invites
CREATE TABLE public.studio_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.studio_streams(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_invites TO authenticated;
GRANT ALL ON public.studio_invites TO service_role;
ALTER TABLE public.studio_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can view invite"
  ON public.studio_invites FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE POLICY "host of stream can create invite"
  ON public.studio_invites FOR INSERT TO authenticated
  WITH CHECK (
    from_user = auth.uid()
    AND EXISTS (SELECT 1 FROM public.studio_streams s WHERE s.id = stream_id AND s.host_id = auth.uid())
  );

CREATE POLICY "recipient can update invite"
  ON public.studio_invites FOR UPDATE TO authenticated
  USING (to_user = auth.uid()) WITH CHECK (to_user = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_invites;
ALTER TABLE public.studio_invites REPLICA IDENTITY FULL;

-- studio_chat_messages
CREATE TABLE public.studio_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.studio_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_chat_messages TO authenticated;
GRANT ALL ON public.studio_chat_messages TO service_role;
ALTER TABLE public.studio_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can view chat of live stream"
  ON public.studio_chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_streams s WHERE s.id = stream_id AND (s.status = 'live' OR s.host_id = auth.uid())));

CREATE POLICY "auth can insert own chat"
  ON public.studio_chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_chat_messages;
