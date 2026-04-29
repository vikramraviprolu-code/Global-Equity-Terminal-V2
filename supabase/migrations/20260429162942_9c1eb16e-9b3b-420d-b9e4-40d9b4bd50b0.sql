
-- Holdings
CREATE TABLE public.holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares NUMERIC NOT NULL CHECK (shares > 0),
  cost_basis NUMERIC NOT NULL CHECK (cost_basis >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX holdings_user_idx ON public.holdings(user_id);
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own holdings" ON public.holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own holdings" ON public.holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own holdings" ON public.holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own holdings" ON public.holdings FOR DELETE USING (auth.uid() = user_id);

-- Alert types
CREATE TYPE public.alert_type AS ENUM (
  'price_above', 'price_below',
  'rsi_above', 'rsi_below',
  'near_52w_high', 'near_52w_low',
  'pct_change_above', 'pct_change_below'
);

-- Alerts
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  alert_type public.alert_type NOT NULL,
  threshold NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alerts_user_idx ON public.alerts(user_id);
CREATE INDEX alerts_active_idx ON public.alerts(active) WHERE active = true;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own alerts" ON public.alerts FOR DELETE USING (auth.uid() = user_id);

-- Alert events (fired alerts)
CREATE TABLE public.alert_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  alert_type public.alert_type NOT NULL,
  threshold NUMERIC NOT NULL,
  value_at_trigger NUMERIC NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alert_events_user_idx ON public.alert_events(user_id, created_at DESC);
CREATE INDEX alert_events_unread_idx ON public.alert_events(user_id) WHERE read = false;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own alert events" ON public.alert_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alert events" ON public.alert_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alert events" ON public.alert_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own alert events" ON public.alert_events FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger for holdings
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER holdings_updated_at BEFORE UPDATE ON public.holdings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
