-- ============================================================================
-- Setup Weekly Payout Batch Processing Cron Job
-- ============================================================================
-- This migration sets up a pg_cron job to process weekly payout batches
-- every Wednesday at 9:00 AM for the previous week (Monday-Sunday).
-- ============================================================================

-- Ensure required extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule job to process weekly payouts every Wednesday at 9:00 AM
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key!
DO $$
DECLARE
  v_service_role_key text;
  v_supabase_url text := 'https://nxxjpstkgbyaazmcybsf.supabase.co';
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
  PERFORM cron.unschedule('process-weekly-payouts') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-weekly-payouts'
  );

  -- Schedule new job: Every Wednesday at 9:00 AM
  -- Cron format: minute hour day-of-month month day-of-week
  -- 0 9 * * 3 = 9:00 AM every Wednesday (3 = Wednesday, 0 = Sunday)
  PERFORM cron.schedule(
    'process-weekly-payouts',
    '0 9 * * 3', -- Every Wednesday at 9:00 AM
    format($$
      SELECT net.http_post(
        url := '%s/functions/v1/process-weekly-payouts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
    $$, v_supabase_url, v_service_role_key)
  );

  RAISE NOTICE 'Scheduled job "process-weekly-payouts" created (runs every Wednesday at 9:00 AM)';
END
$$;

-- Verify job was created
DO $$
DECLARE
  v_job_count integer;
BEGIN
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname = 'process-weekly-payouts';
  
  IF v_job_count = 1 THEN
    RAISE NOTICE '✅ Weekly payout job created successfully!';
  ELSE
    RAISE WARNING '⚠️ Expected 1 job, found %', v_job_count;
  END IF;
END
$$;

COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs for processing weekly payout batches';

