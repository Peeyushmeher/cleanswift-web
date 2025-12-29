-- ============================================================================
-- Setup Transfer Status Sync Cron Job
-- ============================================================================
-- This migration sets up a pg_cron job to sync transfer statuses from Stripe
-- every 6 hours. This acts as a backup mechanism if webhooks fail to update
-- transfer statuses from 'processing' to 'succeeded'.
-- ============================================================================

-- Ensure required extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule job to sync transfer statuses every 6 hours
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key!
DO $$
DECLARE
  v_service_role_key text;
  v_supabase_url text := 'https://YOUR_PROJECT_REF.supabase.co';
BEGIN
  -- Get service role key from environment variable or set it here
  -- For security, you should set this via Supabase Dashboard → Settings → Database → Custom Roles
  -- Or use a secure vault/secret management system
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If not set, you'll need to manually replace the placeholder below
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE NOTICE 'Service role key not found in settings. You must manually replace YOUR_SERVICE_ROLE_KEY_HERE in the cron job.';
    v_service_role_key := 'YOUR_SERVICE_ROLE_KEY_HERE';
  END IF;

  -- Remove existing job if it exists
  PERFORM cron.unschedule('sync-transfer-status') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-transfer-status'
  );

  -- Schedule new job: Every 6 hours
  -- Cron format: minute hour day-of-month month day-of-week
  -- 0 */6 * * * = Every 6 hours (at minute 0 of hours 0, 6, 12, 18)
  PERFORM cron.schedule(
    'sync-transfer-status',
    '0 */6 * * *', -- Every 6 hours
    format($$
      SELECT net.http_post(
        url := '%s/functions/v1/sync-transfer-status',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
    $$, v_supabase_url, v_service_role_key)
  );

  RAISE NOTICE 'Scheduled job "sync-transfer-status" created (runs every 6 hours)';
END
$$;

-- Verify job was created
DO $$
DECLARE
  v_job_count integer;
BEGIN
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname = 'sync-transfer-status';
  
  IF v_job_count = 1 THEN
    RAISE NOTICE '✅ Transfer status sync job created successfully!';
  ELSE
    RAISE WARNING '⚠️ Expected 1 job, found %', v_job_count;
  END IF;
END
$$;

COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs for syncing transfer statuses from Stripe API';

