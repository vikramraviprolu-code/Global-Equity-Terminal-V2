-- Create dedicated schema for extensions
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Unschedule cron job that depends on net.http_post
SELECT cron.unschedule('run-scheduled-briefs-hourly');

-- pg_net does not support SET SCHEMA, so drop and recreate it in extensions
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Re-schedule the hourly cron job, calling the new schema-qualified function
SELECT cron.schedule(
  'run-scheduled-briefs-hourly',
  '5 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://project--b6e0c78a-18e3-4026-9c43-84c46fb44e61.lovable.app/api/public/hooks/run-scheduled-briefs',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);