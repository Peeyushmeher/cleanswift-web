-- ============================================================================
-- NOTIFICATION SYSTEM MIGRATION
-- ============================================================================
-- This migration adds:
-- 1. detailer_notification_preferences - Per-detailer notification settings
-- 2. notification_logs - Track all sent notifications
-- 3. Database trigger to notify on booking cancellation
-- ============================================================================

-- ============================================================================
-- 1. DETAILER NOTIFICATION PREFERENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS detailer_notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
    
    -- Global toggles
    sms_enabled boolean NOT NULL DEFAULT true,
    email_enabled boolean NOT NULL DEFAULT true,
    
    -- Per-event SMS toggles
    new_booking_sms boolean NOT NULL DEFAULT true,
    booking_cancelled_sms boolean NOT NULL DEFAULT true,
    booking_reminder_sms boolean NOT NULL DEFAULT true,
    payout_sms boolean NOT NULL DEFAULT true,
    
    -- Per-event Email toggles
    new_booking_email boolean NOT NULL DEFAULT true,
    booking_cancelled_email boolean NOT NULL DEFAULT true,
    booking_reminder_email boolean NOT NULL DEFAULT true,
    payout_email boolean NOT NULL DEFAULT true,
    
    -- Reminder timing (hours before booking)
    reminder_hours_before integer NOT NULL DEFAULT 24,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Each detailer can only have one preferences record
    CONSTRAINT unique_detailer_notification_prefs UNIQUE(detailer_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_detailer_notification_preferences_detailer_id 
    ON detailer_notification_preferences(detailer_id);

-- Add comments
COMMENT ON TABLE detailer_notification_preferences IS 
    'Stores notification preferences for each detailer (SMS and Email settings)';
COMMENT ON COLUMN detailer_notification_preferences.sms_enabled IS 
    'Global toggle for all SMS notifications';
COMMENT ON COLUMN detailer_notification_preferences.email_enabled IS 
    'Global toggle for all email notifications';
COMMENT ON COLUMN detailer_notification_preferences.reminder_hours_before IS 
    'How many hours before a booking to send reminder notification';

-- ============================================================================
-- 2. NOTIFICATION LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    detailer_id uuid REFERENCES detailers(id) ON DELETE SET NULL,
    
    -- Notification details
    notification_type text NOT NULL, -- 'new_booking', 'booking_cancelled', 'booking_reminder', 'payout_processed'
    channel text NOT NULL, -- 'sms' or 'email'
    recipient text NOT NULL, -- phone number or email address
    
    -- Status tracking
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    provider_id text, -- Twilio Message SID or Resend Email ID
    error_message text,
    
    -- Additional context
    metadata jsonb DEFAULT '{}'::jsonb, -- Store booking_id, payout_id, etc.
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_notification_type CHECK (
        notification_type IN ('new_booking', 'booking_cancelled', 'booking_reminder', 'payout_processed')
    ),
    CONSTRAINT valid_channel CHECK (channel IN ('sms', 'email')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_detailer_id ON notification_logs(detailer_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);

-- Add comments
COMMENT ON TABLE notification_logs IS 
    'Tracks all SMS and email notifications sent to detailers';
COMMENT ON COLUMN notification_logs.provider_id IS 
    'Twilio Message SID for SMS, Resend Email ID for emails';
COMMENT ON COLUMN notification_logs.metadata IS 
    'Additional context like booking_id, amount, service_name, etc.';

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE detailer_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Detailers can view and update their own notification preferences
CREATE POLICY "Detailers can view own notification preferences"
    ON detailer_notification_preferences
    FOR SELECT
    USING (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Detailers can update own notification preferences"
    ON detailer_notification_preferences
    FOR UPDATE
    USING (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Detailers can insert own notification preferences"
    ON detailer_notification_preferences
    FOR INSERT
    WITH CHECK (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
    );

-- Admins can manage all notification preferences
CREATE POLICY "Admins can manage all notification preferences"
    ON detailer_notification_preferences
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Detailers can view their own notification logs
CREATE POLICY "Detailers can view own notification logs"
    ON notification_logs
    FOR SELECT
    USING (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
    );

-- Admins can view all notification logs
CREATE POLICY "Admins can view all notification logs"
    ON notification_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role can insert/update notification logs (for Edge Functions)
-- This is handled automatically by service role key bypassing RLS

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

-- Reuse existing update_updated_at_column function
CREATE TRIGGER update_detailer_notification_preferences_updated_at 
    BEFORE UPDATE ON detailer_notification_preferences
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. AUTO-CREATE PREFERENCES FOR NEW DETAILERS
-- ============================================================================

-- Function to create default notification preferences for new detailers
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert default preferences for the new detailer
    INSERT INTO detailer_notification_preferences (detailer_id)
    VALUES (NEW.id)
    ON CONFLICT (detailer_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Trigger to auto-create preferences when a new detailer is created
DROP TRIGGER IF EXISTS create_notification_preferences_on_detailer_insert ON detailers;
CREATE TRIGGER create_notification_preferences_on_detailer_insert
    AFTER INSERT ON detailers
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- Create preferences for existing detailers
INSERT INTO detailer_notification_preferences (detailer_id)
SELECT id FROM detailers
WHERE id NOT IN (SELECT detailer_id FROM detailer_notification_preferences)
ON CONFLICT (detailer_id) DO NOTHING;

-- ============================================================================
-- 6. HELPER FUNCTION TO GET DETAILER NOTIFICATION INFO
-- ============================================================================

-- Function to get detailer contact info and preferences
CREATE OR REPLACE FUNCTION get_detailer_notification_info(p_detailer_id uuid)
RETURNS TABLE (
    detailer_id uuid,
    full_name text,
    email text,
    phone text,
    sms_enabled boolean,
    email_enabled boolean,
    new_booking_sms boolean,
    new_booking_email boolean,
    booking_cancelled_sms boolean,
    booking_cancelled_email boolean,
    booking_reminder_sms boolean,
    booking_reminder_email boolean,
    payout_sms boolean,
    payout_email boolean,
    reminder_hours_before integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as detailer_id,
        p.full_name,
        p.email,
        p.phone,
        COALESCE(np.sms_enabled, true) as sms_enabled,
        COALESCE(np.email_enabled, true) as email_enabled,
        COALESCE(np.new_booking_sms, true) as new_booking_sms,
        COALESCE(np.new_booking_email, true) as new_booking_email,
        COALESCE(np.booking_cancelled_sms, true) as booking_cancelled_sms,
        COALESCE(np.booking_cancelled_email, true) as booking_cancelled_email,
        COALESCE(np.booking_reminder_sms, true) as booking_reminder_sms,
        COALESCE(np.booking_reminder_email, true) as booking_reminder_email,
        COALESCE(np.payout_sms, true) as payout_sms,
        COALESCE(np.payout_email, true) as payout_email,
        COALESCE(np.reminder_hours_before, 24) as reminder_hours_before
    FROM detailers d
    JOIN profiles p ON d.profile_id = p.id
    LEFT JOIN detailer_notification_preferences np ON np.detailer_id = d.id
    WHERE d.id = p_detailer_id;
END;
$$;

COMMENT ON FUNCTION get_detailer_notification_info IS 
    'Returns detailer contact info and notification preferences for sending notifications';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_detailer_notification_info TO authenticated;
GRANT EXECUTE ON FUNCTION get_detailer_notification_info TO service_role;

-- ============================================================================
-- 7. FUNCTION TO LOG NOTIFICATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_notification(
    p_detailer_id uuid,
    p_notification_type text,
    p_channel text,
    p_recipient text,
    p_status text,
    p_provider_id text DEFAULT NULL,
    p_error_message text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO notification_logs (
        detailer_id,
        notification_type,
        channel,
        recipient,
        status,
        provider_id,
        error_message,
        metadata
    )
    VALUES (
        p_detailer_id,
        p_notification_type,
        p_channel,
        p_recipient,
        p_status,
        p_provider_id,
        p_error_message,
        p_metadata
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION log_notification IS 
    'Logs a notification attempt for tracking and debugging';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_notification TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

