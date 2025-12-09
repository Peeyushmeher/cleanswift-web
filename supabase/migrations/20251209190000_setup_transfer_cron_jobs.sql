-- ============================================================================
-- Setup Scheduled Jobs for Transfer Processing
-- ============================================================================
-- This migration sets up pg_cron jobs to automatically process pending
-- transfers and retry failed transfers.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Get service role key from environment (you'll need to replace this)
-- Note: In production, use a secure method to get the service role key
-- For now, you'll need to manually replace YOUR_SERVICE_ROLE_KEY_HERE

-- Schedule job to process pending transfers every 5 minutes
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
  PERFORM cron.unschedule('process-pending-transfers') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-pending-transfers'
  );

  -- Schedule new job
  PERFORM cron.schedule(
    'process-pending-transfers',
    '*/5 * * * *', -- Every 5 minutes
    format($$
      SELECT net.http_post(
        url := '%s/functions/v1/process-pending-transfers',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
    $$, v_supabase_url, v_service_role_key)
  );

  RAISE NOTICE 'Scheduled job "process-pending-transfers" created';
END
$$;

-- Schedule job to retry failed transfers every 15 minutes
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key!
DO $$
DECLARE
  v_service_role_key text;
  v_supabase_url text := 'https://nxxjpstkgbyaazmcybsf.supabase.co';
BEGIN
  -- Get service role key (same as above)
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    v_service_role_key := 'YOUR_SERVICE_ROLE_KEY_HERE';
  END IF;

  -- Remove existing job if it exists
  PERFORM cron.unschedule('retry-failed-transfers') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'retry-failed-transfers'
  );

  -- Schedule new job
  PERFORM cron.schedule(
    'retry-failed-transfers',
    '*/15 * * * *', -- Every 15 minutes
    format($$
      SELECT net.http_post(
        url := '%s/functions/v1/retry-failed-transfers',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
    $$, v_supabase_url, v_service_role_key)
  );

  RAISE NOTICE 'Scheduled job "retry-failed-transfers" created';
END
$$;

-- Verify jobs were created
DO $$
DECLARE
  v_job_count integer;
BEGIN
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname IN ('process-pending-transfers', 'retry-failed-transfers');
  
  IF v_job_count = 2 THEN
    RAISE NOTICE '✅ Both scheduled jobs created successfully!';
  ELSE
    RAISE WARNING '⚠️ Expected 2 jobs, found %', v_job_count;
  END IF;
END
$$;

COMMENT ON EXTENSION pg_cron IS 'Enables scheduled jobs for processing transfers';
COMMENT ON EXTENSION pg_net IS 'Enables HTTP requests from PostgreSQL for calling Edge Functions';

