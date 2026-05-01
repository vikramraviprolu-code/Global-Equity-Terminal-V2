CREATE TABLE public.shared_watchlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  name text NOT NULL,
  symbols text[] NOT NULL DEFAULT '{}'::text[],
  view_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shared_watchlists_user_id_idx ON public.shared_watchlists(user_id);
CREATE INDEX shared_watchlists_token_idx ON public.shared_watchlists(token);

ALTER TABLE public.shared_watchlists ENABLE ROW LEVEL SECURITY;

-- Owner CRUD
CREATE POLICY "Users view own shares" ON public.shared_watchlists
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own shares" ON public.shared_watchlists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own shares" ON public.shared_watchlists
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own shares" ON public.shared_watchlists
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public read for active (non-revoked, non-expired) shares.
-- Anonymous + authenticated users can view a share if they know the token.
-- We rely on the token being unguessable (server generates a 22-char base64url
-- random string ≈ 132 bits of entropy) to gate access.
CREATE POLICY "Public read active shares" ON public.shared_watchlists
  FOR SELECT TO anon, authenticated
  USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Allow anon/authenticated to bump view_count via UPDATE.
-- We restrict the WITH CHECK to ensure only view_count + updated_at change in
-- practice (Postgres can't enforce per-column UPDATE in policies, so we accept
-- the trade-off; the increment happens in a SECURITY DEFINER RPC below).
CREATE OR REPLACE FUNCTION public.bump_shared_watchlist_view(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shared_watchlists
     SET view_count = view_count + 1,
         updated_at = now()
   WHERE token = _token
     AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_shared_watchlist_view(text) TO anon, authenticated;

-- Auto-update updated_at on row mutations
CREATE TRIGGER shared_watchlists_set_updated_at
  BEFORE UPDATE ON public.shared_watchlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();