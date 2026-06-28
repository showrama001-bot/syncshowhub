
CREATE TABLE public.tv_channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tv_channel_messages_channel_idx ON public.tv_channel_messages(channel_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.tv_channel_messages TO authenticated;
GRANT ALL ON public.tv_channel_messages TO service_role;

ALTER TABLE public.tv_channel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read tv chat" ON public.tv_channel_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "send tv chat" ON public.tv_channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_banned)
  );

CREATE POLICY "delete own or admin tv chat" ON public.tv_channel_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_channel_messages;
ALTER TABLE public.tv_channel_messages REPLICA IDENTITY FULL;
