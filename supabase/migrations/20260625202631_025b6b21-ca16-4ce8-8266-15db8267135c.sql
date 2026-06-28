
-- Lock down SECURITY DEFINER functions: revoke from PUBLIC and re-grant only where clients need RPC access.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_device_banned(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_watch_room_password(uuid, text) FROM PUBLIC, anon, authenticated;

-- Client-callable RPCs: explicitly grant only the roles that need them.
GRANT EXECUTE ON FUNCTION public.is_device_banned(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_watch_room_password(uuid, text) TO authenticated;
