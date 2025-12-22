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
      url := 'https://nxxjpstkgbyaazmcybsf.supabase.co/functions/v1/process-weekly-payouts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGpwc3RrZ2J5YWF6bWN5YnNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI5NzY2OCwiZXhwIjoyMDc4ODczNjY4fQ.q9_N7IQB84m9FdxHW6DNMOwiPDZ9M9miybN5qwPopNQ'
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

