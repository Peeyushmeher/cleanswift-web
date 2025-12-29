-- ============================================================================
-- Setup Weekly Payout Batch Processing Cron Job (FIXED VERSION)
-- ============================================================================
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key
-- Get it from: Supabase Dashboard → Settings → API → service_role key
-- ============================================================================

-- Ensure required extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule job to process weekly payouts every Wednesday at 9:00 AM
-- Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key!
SELECT cron.schedule(
  'process-weekly-payouts',
  '0 9 * * 3', -- Every Wednesday at 9:00 AM (0 = Sunday, 3 = Wednesday)
  $cron$
    SELECT net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-weekly-payouts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
      ),
      body := '{}'::jsonb
    );
  $cron$
);

-- Verify job was created
SELECT 
  jobid,
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname = 'process-weekly-payouts';

