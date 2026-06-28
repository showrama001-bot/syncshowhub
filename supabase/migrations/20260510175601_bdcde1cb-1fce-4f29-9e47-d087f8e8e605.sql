GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;

ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS voe_sx_url text,
  ADD COLUMN IF NOT EXISTS streamtape_url text;