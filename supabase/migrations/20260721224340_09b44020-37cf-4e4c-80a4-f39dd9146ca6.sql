
REVOKE EXECUTE ON FUNCTION public.fanout_host_notification(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_watch_room_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_studio_stream_live() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_room_reminders() FROM PUBLIC, anon, authenticated;
