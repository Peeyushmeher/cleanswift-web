-- ============================================================================
-- Add Unique Constraint on payments.booking_id
-- ============================================================================
-- This migration adds a unique constraint to ensure one payment record per booking.
-- This is required for idempotent webhook processing and data integrity.
-- ============================================================================

-- Add unique constraint on booking_id (if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_booking_id_key'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_booking_id_key UNIQUE (booking_id);
    
    COMMENT ON CONSTRAINT payments_booking_id_key ON payments IS 'Ensures one payment record per booking for idempotent webhook processing';
  END IF;
END
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The payments table now has a unique constraint on booking_id, ensuring
-- one payment record per booking. This enables idempotent upsert operations
-- in the Stripe webhook handler.
-- ============================================================================

