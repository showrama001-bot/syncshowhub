DROP TABLE IF EXISTS public.ads_assets CASCADE;
DROP TABLE IF EXISTS public.ads_settings CASCADE;
DROP TYPE IF EXISTS public.ad_placement CASCADE;

CREATE TABLE public.ad_system (
  id integer PRIMARY KEY DEFAULT 1,
  master_enabled boolean NOT NULL DEFAULT true,

  network_enabled boolean NOT NULL DEFAULT true,
  global_scripts text NOT NULL DEFAULT '',
  header_banner_script text NOT NULL DEFAULT '',
  grid_banner_script text NOT NULL DEFAULT '',
  under_player_script text NOT NULL DEFAULT '',

  vip_enabled boolean NOT NULL DEFAULT true,
  pause_banner_url text,
  pause_banner_link text,
  hero_banner_url text,
  hero_banner_link text,
  room_takeover_url text,

  timeline_enabled boolean NOT NULL DEFAULT true,
  preroll_url text,
  preroll_link text,
  postroll_url text,
  postroll_link text,
  skip_seconds integer NOT NULL DEFAULT 5,

  break_enabled boolean NOT NULL DEFAULT false,
  break_trigger_seconds integer NOT NULL DEFAULT 1800,
  hook_image_url text,
  hook_duration_seconds integer NOT NULL DEFAULT 5,
  break_queue jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_system_singleton CHECK (id = 1)
);

GRANT SELECT ON public.ad_system TO anon;
GRANT SELECT ON public.ad_system TO authenticated;
GRANT ALL ON public.ad_system TO service_role;

ALTER TABLE public.ad_system ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ad config is readable by everyone"
  ON public.ad_system FOR SELECT
  USING (true);

CREATE POLICY "Admins manage ad config"
  ON public.ad_system FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT INSERT, UPDATE, DELETE ON public.ad_system TO authenticated;

CREATE TRIGGER ad_system_touch_updated_at
  BEFORE UPDATE ON public.ad_system
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.ad_system (id) VALUES (1) ON CONFLICT (id) DO NOTHING;