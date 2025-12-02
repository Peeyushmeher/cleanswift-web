-- ============================================================================
-- Fix accept_booking Function for Detailer-Profile Link
-- ============================================================================
-- This migration updates the accept_booking function to work with the new
-- detailer-profile link. Instead of using auth.uid() directly as detailer_id,
-- it now finds the detailer record linked to the profile and uses that detailer.id.
--
-- Changes:
-- 1. Find detailer record by profile_id = auth.uid()
-- 2. Use detailer.id (not profile.id) when assigning booking
-- 3. Validate detailer exists and is active
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_booking(
  p_booking_id uuid
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  current_status booking_status_enum;
  current_detailer_id uuid;
  current_payment_status payment_status_enum;
  detailer_record_id uuid;
  updated_booking bookings;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Get user role from profiles
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3) Verify caller is a detailer or admin
  IF current_role NOT IN ('detailer', 'admin') THEN
    RAISE EXCEPTION 'Only detailers and admins can accept bookings';
  END IF;

  -- 4) For detailers, find their detailer record
  IF current_role = 'detailer' THEN
    SELECT id INTO detailer_record_id
    FROM detailers
    WHERE profile_id = current_user_id
      AND is_active = true;
    
    IF detailer_record_id IS NULL THEN
      RAISE EXCEPTION 'Detailer record not found. Please ensure your detailer profile is set up.';
    END IF;
  ELSE
    -- For admins, we need to handle this differently
    -- Admins can accept bookings but we need a detailer_id
    -- For now, admins cannot accept bookings (they should assign detailers instead)
    RAISE EXCEPTION 'Admins cannot accept bookings. Use assign_detailer_to_booking instead.';
  END IF;

  -- 5) Lock and fetch booking (prevents concurrent accepts)
  SELECT 
    status,
    detailer_id,
    payment_status
  INTO 
    current_status,
    current_detailer_id,
    current_payment_status
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 6) Validate booking is available for acceptance
  -- Check payment status
  IF current_payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Booking is not paid. Payment status: %', current_payment_status;
  END IF;

  -- Check if already assigned
  IF current_detailer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Booking is already assigned to another detailer';
  END IF;

  -- Check if status allows acceptance
  IF current_status NOT IN ('paid', 'offered') THEN
    RAISE EXCEPTION 'Booking status "%" does not allow acceptance. Booking must be "paid" or "offered"', current_status;
  END IF;

  -- 7) Assign booking to detailer and update status
  UPDATE bookings
  SET 
    detailer_id = detailer_record_id,
    status = 'accepted',
    updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO updated_booking;

  -- 8) Return updated booking
  RETURN updated_booking;
END;
$$;

COMMENT ON FUNCTION public.accept_booking IS 
'Allows a detailer to claim a paid, unassigned booking. Finds detailer record by profile_id and uses detailer.id for assignment. Race-condition safe using row locking. Sets detailer_id and status to "accepted".';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The accept_booking function now:
-- - Finds detailer record by profile_id = auth.uid()
-- - Uses detailer.id (not profile.id) when assigning booking
-- - Validates detailer exists and is active
-- - Prevents admins from accepting (they should use assign_detailer_to_booking)
-- ============================================================================

