
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (user_id, endpoint, called_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies: only service role can access (server-side only)

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id UUID,
  _endpoint TEXT,
  _max_calls INTEGER,
  _window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Count calls in window
  SELECT COUNT(*) INTO recent_count
  FROM public.rate_limits
  WHERE user_id = _user_id
    AND endpoint = _endpoint
    AND called_at > now() - make_interval(secs => _window_seconds);

  IF recent_count >= _max_calls THEN
    RETURN FALSE;
  END IF;

  -- Record this call
  INSERT INTO public.rate_limits (user_id, endpoint) VALUES (_user_id, _endpoint);

  -- Opportunistic cleanup of old rows (1 in 100 calls)
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
    WHERE called_at < now() - INTERVAL '24 hours';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
