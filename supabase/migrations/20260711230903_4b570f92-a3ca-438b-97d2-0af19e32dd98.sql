
CREATE TABLE public.watch_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_kind text NOT NULL,
  content_id uuid NOT NULL,
  content_title text,
  genre text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX watch_history_user_idx ON public.watch_history(user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.watch_history TO authenticated;
GRANT ALL ON public.watch_history TO service_role;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own watch history" ON public.watch_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own watch history" ON public.watch_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own watch history" ON public.watch_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
