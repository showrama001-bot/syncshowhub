
CREATE TABLE public.active_stream (
  id integer PRIMARY KEY DEFAULT 1,
  host_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  movie_id uuid,
  title text,
  poster_url text,
  stream_url text,
  status text NOT NULL DEFAULT 'offline',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT active_stream_singleton CHECK (id = 1)
);

GRANT SELECT ON public.active_stream TO authenticated;
GRANT SELECT ON public.active_stream TO anon;
GRANT ALL ON public.active_stream TO service_role;

ALTER TABLE public.active_stream ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the active stream"
  ON public.active_stream FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert active stream"
  ON public.active_stream FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update active stream"
  ON public.active_stream FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER active_stream_updated_at
  BEFORE UPDATE ON public.active_stream
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.active_stream (id, status) VALUES (1, 'offline')
  ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.active_stream;
ALTER TABLE public.active_stream REPLICA IDENTITY FULL;
