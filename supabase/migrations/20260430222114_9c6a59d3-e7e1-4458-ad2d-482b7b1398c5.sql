-- v1.7: Alerts × Theses + Scheduled Morning Brief

-- 1. Add 'thesis_break' to alert_type enum so thesis flips can fire alerts.
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'thesis_break';

-- 2. brief_schedules: per-user opt-in to daily Morning Brief generation.
CREATE TABLE IF NOT EXISTS public.brief_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  hour_utc smallint NOT NULL DEFAULT 13 CHECK (hour_utc >= 0 AND hour_utc <= 23),
  symbols text[] NOT NULL DEFAULT '{}',
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brief_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own schedule" ON public.brief_schedules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own schedule" ON public.brief_schedules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own schedule" ON public.brief_schedules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own schedule" ON public.brief_schedules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_brief_schedules_updated_at
  BEFORE UPDATE ON public.brief_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_brief_schedules_hour_enabled
  ON public.brief_schedules (hour_utc) WHERE enabled = true;