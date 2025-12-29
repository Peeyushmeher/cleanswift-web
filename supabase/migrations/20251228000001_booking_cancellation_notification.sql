-- ============================================================================
-- BOOKING CANCELLATION NOTIFICATION TRIGGER
-- ============================================================================
-- This migration adds a database trigger that fires when a booking is cancelled.
-- It calls the Edge Function to notify the assigned detailer.
-- ============================================================================

-- Create the function that will be called on booking cancellation
CREATE OR REPLACE FUNCTION notify_detailer_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_detailer_id uuid;
    v_service_name text;
    v_customer_name text;
    v_scheduled_date text;
    v_scheduled_time text;
    v_city text;
    v_supabase_url text;
    v_service_role_key text;
BEGIN
    -- Only trigger if status changed TO 'cancelled' and there's an assigned detailer
    IF NEW.status = 'cancelled' 
       AND (OLD.status IS NULL OR OLD.status != 'cancelled')
       AND NEW.detailer_id IS NOT NULL THEN
        
        -- Get booking details for notification
        v_detailer_id := NEW.detailer_id;
        v_city := NEW.city;
        
        -- Get service name
        SELECT name INTO v_service_name
        FROM services
        WHERE id = NEW.service_id;
        
        -- Get customer name
        SELECT full_name INTO v_customer_name
        FROM profiles
        WHERE id = NEW.user_id;
        
        -- Format date and time
        v_scheduled_date := to_char(NEW.scheduled_date, 'Day, Month DD');
        v_scheduled_time := to_char(NEW.scheduled_time_start, 'HH12:MI AM');
        
        -- Use pg_notify to trigger an async process
        -- This sends a notification that can be listened to by a background worker
        PERFORM pg_notify(
            'booking_cancelled',
            json_build_object(
                'detailer_id', v_detailer_id,
                'booking_id', NEW.id,
                'service_name', COALESCE(v_service_name, 'Auto Detailing'),
                'customer_name', COALESCE(v_customer_name, 'Customer'),
                'scheduled_date', v_scheduled_date,
                'scheduled_time', COALESCE(v_scheduled_time, 'TBD'),
                'city', COALESCE(v_city, '')
            )::text
        );
        
        -- Also insert into a queue table for the Edge Function to process
        -- This ensures notifications are sent even if pg_notify is missed
        INSERT INTO notification_logs (
            detailer_id,
            notification_type,
            channel,
            recipient,
            status,
            metadata
        )
        VALUES (
            v_detailer_id,
            'booking_cancelled',
            'pending', -- Will be updated to 'sms' or 'email' when processed
            'pending', -- Will be updated when processed
            'pending',
            jsonb_build_object(
                'booking_id', NEW.id,
                'service_name', COALESCE(v_service_name, 'Auto Detailing'),
                'customer_name', COALESCE(v_customer_name, 'Customer'),
                'scheduled_date', v_scheduled_date,
                'scheduled_time', COALESCE(v_scheduled_time, 'TBD'),
                'city', COALESCE(v_city, ''),
                'needs_processing', true
            )
        );
        
        RAISE LOG 'Booking cancellation notification queued for detailer %', v_detailer_id;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_detailer_on_cancellation IS 
    'Queues a notification to the detailer when a booking is cancelled';

-- Create the trigger
DROP TRIGGER IF EXISTS notify_detailer_on_booking_cancelled ON bookings;
CREATE TRIGGER notify_detailer_on_booking_cancelled
    AFTER UPDATE OF status ON bookings
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
    EXECUTE FUNCTION notify_detailer_on_cancellation();

-- ============================================================================
-- EDGE FUNCTION TO PROCESS PENDING CANCELLATION NOTIFICATIONS
-- ============================================================================
-- We also need a scheduled function to process pending notifications.
-- This acts as a fallback and batch processor.
-- The Edge Function 'process-pending-notifications' will be called by a cron job.
-- ============================================================================

-- Create a function to get pending cancellation notifications
CREATE OR REPLACE FUNCTION get_pending_cancellation_notifications()
RETURNS TABLE (
    log_id uuid,
    detailer_id uuid,
    booking_id uuid,
    service_name text,
    customer_name text,
    scheduled_date text,
    scheduled_time text,
    city text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nl.id as log_id,
        nl.detailer_id,
        (nl.metadata->>'booking_id')::uuid as booking_id,
        nl.metadata->>'service_name' as service_name,
        nl.metadata->>'customer_name' as customer_name,
        nl.metadata->>'scheduled_date' as scheduled_date,
        nl.metadata->>'scheduled_time' as scheduled_time,
        nl.metadata->>'city' as city
    FROM notification_logs nl
    WHERE nl.notification_type = 'booking_cancelled'
      AND nl.status = 'pending'
      AND (nl.metadata->>'needs_processing')::boolean = true
    ORDER BY nl.created_at ASC
    LIMIT 50; -- Process in batches
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_cancellation_notifications TO service_role;

-- Function to mark notification as processed
CREATE OR REPLACE FUNCTION mark_cancellation_notification_processed(
    p_log_id uuid,
    p_channel text,
    p_recipient text,
    p_status text,
    p_provider_id text DEFAULT NULL,
    p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE notification_logs
    SET 
        channel = p_channel,
        recipient = p_recipient,
        status = p_status,
        provider_id = p_provider_id,
        error_message = p_error_message,
        metadata = metadata - 'needs_processing'
    WHERE id = p_log_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_cancellation_notification_processed TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

