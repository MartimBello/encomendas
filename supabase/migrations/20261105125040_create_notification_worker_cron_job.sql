create extension if not exists pg_net with schema extensions;

-- The values are deliberately resolved from Vault at execution time so that
-- neither the project URL nor the worker credential is stored in migrations.
-- Required Vault secret names:
--   project_url: https://<project-ref>.supabase.co
--   notification_worker_secret: the NOTIFICATION_WORKER_SECRET Edge secret
select cron.schedule(
  'process-notification-outbox-every-minute',
  '* * * * *',
  $job$
    select net.http_post(
      url := rtrim(
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'project_url'),
        '/'
      ) || '/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-worker-secret',
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'notification_worker_secret')
      ),
      body := '{"limit": 50}'::jsonb
    ) as request_id;
  $job$
);
