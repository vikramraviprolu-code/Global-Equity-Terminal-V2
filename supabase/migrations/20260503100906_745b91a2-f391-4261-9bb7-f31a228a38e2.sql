-- Lock down SECURITY DEFINER functions: revoke EXECUTE from public/anon/authenticated
-- for functions that should only be called server-side (service role).
-- has_role is intentionally left executable by authenticated because RLS policies
-- invoke it during policy evaluation as the calling role.

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_shared_watchlist_view(text) FROM PUBLIC, anon, authenticated;