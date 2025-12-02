-- ============================================================================
-- Migrate bookings.status to use booking_status_enum
-- ============================================================================
-- This migration:
-- 1. Maps old status values to new enum values
-- 2. Drops the CHECK constraint
-- 3. Converts the column to use booking_status_enum
-- 4. Updates existing data to match new enum values
-- ============================================================================

-- Step 1: Map old status values to new enum values
-- Old: 'scheduled' -> New: 'paid' (if payment_status = 'paid') or 'requires_payment'
-- Old: 'in_progress' -> New: 'in_progress' (same)
-- Old: 'completed' -> New: 'completed' (same)
-- Old: 'canceled' -> New: 'cancelled' (note: spelling change)

DO $$
BEGIN
  -- Update 'scheduled' to 'paid' if payment_status is 'paid', otherwise 'requires_payment'
  UPDATE bookings
  SET status = CASE
    WHEN payment_status = 'paid' THEN 'paid'
    ELSE 'requires_payment'
  END
  WHERE status = 'scheduled';

  -- Update 'canceled' to 'cancelled' (spelling change)
  UPDATE bookings
  SET status = 'cancelled'
  WHERE status = 'canceled';

  -- 'in_progress' and 'completed' remain the same
END
$$;

-- Step 2: Drop the old CHECK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_status_check'
  ) THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
  END IF;
END
$$;

-- Step 3: Convert column to use enum type
-- We need to cast the text values to the enum type
DO $$
BEGIN
  -- First, ensure all values in the column are valid enum values
  -- This should already be done by the UPDATE statements above
  
  -- Alter the column type
  ALTER TABLE bookings
    ALTER COLUMN status TYPE booking_status_enum
    USING status::text::booking_status_enum;
  
  COMMENT ON COLUMN bookings.status IS 'Booking lifecycle status using booking_status_enum';
END
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The bookings.status column now uses booking_status_enum.
-- Old values have been mapped:
-- - 'scheduled' -> 'paid' (if payment_status='paid') or 'requires_payment'
-- - 'canceled' -> 'cancelled'
-- - 'in_progress' -> 'in_progress' (unchanged)
-- - 'completed' -> 'completed' (unchanged)
-- ============================================================================

