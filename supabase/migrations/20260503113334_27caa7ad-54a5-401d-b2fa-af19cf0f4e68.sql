-- check_rate_limit is invoked from the server via the service-role client only.
-- Revoke execute from regular users to satisfy linter 0029.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;