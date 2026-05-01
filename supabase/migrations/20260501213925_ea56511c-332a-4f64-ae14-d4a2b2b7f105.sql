-- Store CRON_SECRET in vault so pg_cron can read it without hardcoding in SQL.
-- The user must update this value to match the CRON_SECRET runtime env var.
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'CRON_SECRET';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret('PLACEHOLDER_REPLACE_ME', 'CRON_SECRET', 'Shared secret for /api/public/hooks/run-scheduled-briefs');
  END IF;
END $$;

-- Unschedule the existing job (no header) and reschedule with the secret header.
SELECT cron.unschedule('run-scheduled-briefs-hourly');

SELECT cron.schedule(
  'run-scheduled-briefs-hourly',
  '5 * * * *',
  $cron$
  SELECT extensions.http_post(
    url := 'https://project--b6e0c78a-18e3-4026-9c43-84c46fb44e61.lovable.app/api/public/hooks/run-scheduled-briefs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);