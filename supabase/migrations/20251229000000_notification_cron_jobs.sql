-- ============================================
-- CRON JOBS FOR NOTIFICATION SYSTEM
-- ============================================
-- This migration sets up scheduled tasks to:
-- 1. Send booking reminders (every hour)
-- 2. Process cancellation notifications (every 5 minutes)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================
-- Store secrets in Vault for Edge Function calls
-- ============================================
-- NOTE: You must run these commands manually after deployment:
-- 
-- SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

-- ============================================
-- CRON JOB 1: Send Booking Reminders
-- Runs every hour at minute 0
-- ============================================
SELECT cron.schedule(
  'send-booking-reminders',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-booking-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- CRON JOB 2: Process Cancellation Notifications
-- Runs every 5 minutes
-- ============================================
SELECT cron.schedule(
  'process-cancellation-notifications',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/process-cancellation-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================
-- Helper function to check cron job status
-- ============================================
CREATE OR REPLACE FUNCTION public.get_cron_job_status()
RETURNS TABLE (
  jobname text,
  schedule text,
  last_run timestamptz,
  next_run timestamptz,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT 
    j.jobname,
    j.schedule,
    jr.start_time as last_run,
    -- Calculate next run (approximate)
    CASE 
      WHEN jr.start_time IS NULL THEN now()
      ELSE jr.start_time + (
        CASE j.schedule
          WHEN '0 * * * *' THEN INTERVAL '1 hour'
          WHEN '*/5 * * * *' THEN INTERVAL '5 minutes'
          ELSE INTERVAL '1 hour'
        END
      )
    END as next_run,
    j.active
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time 
    FROM cron.job_run_details 
    WHERE jobid = j.jobid 
    ORDER BY start_time DESC 
    LIMIT 1
  ) jr ON true
  WHERE j.jobname IN ('send-booking-reminders', 'process-cancellation-notifications');
$$;

COMMENT ON FUNCTION public.get_cron_job_status IS 'Returns the status of notification cron jobs';

