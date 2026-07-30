GRANT EXECUTE ON FUNCTION private.get_my_ban_status() TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_count_banned() TO authenticated;
GRANT EXECUTE ON FUNCTION private.admin_get_ban_status(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_device_banned(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.verify_watch_room_password(uuid, text) TO anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated;