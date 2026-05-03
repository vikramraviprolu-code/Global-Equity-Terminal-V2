-- rate_limits is written/read exclusively via the check_rate_limit SECURITY DEFINER
-- function. No end-user should access it directly. Add explicit deny-by-default
-- policies (service_role only) to satisfy RLS-enabled-no-policy.

CREATE POLICY "Service role manages rate_limits"
ON public.rate_limits
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');