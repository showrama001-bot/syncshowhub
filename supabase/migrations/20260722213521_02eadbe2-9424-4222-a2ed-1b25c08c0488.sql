
REVOKE EXECUTE ON FUNCTION public.get_my_ban_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_count_banned() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_ban_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ban_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_count_banned() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ban_status(uuid[]) TO authenticated;
