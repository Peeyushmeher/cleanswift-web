-- ============================================================================
-- Create accept_booking RPC Function
-- ============================================================================
-- This function allows a detailer to "claim" a paid, unassigned booking.
-- It is race-condition safe using row locking (FOR UPDATE).
--
-- Requirements:
-- - Caller must be a detailer (or admin)
-- - Booking must have payment_status = 'paid'
-- - Booking must not already have a detailer assigned (detailer_id IS NULL)
-- - Booking status must be 'paid' or 'offered'
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

  -- 4) Lock and fetch booking (prevents concurrent accepts)
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

  -- 5) Validate booking is available for acceptance
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

  -- 6) Assign booking to detailer and update status
  UPDATE bookings
  SET 
    detailer_id = current_user_id,
    status = 'accepted',
    updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO updated_booking;

  -- 7) Return updated booking
  RETURN updated_booking;
END;
$$;

COMMENT ON FUNCTION public.accept_booking IS 
'Allows a detailer to claim a paid, unassigned booking. Race-condition safe using row locking. Sets detailer_id and status to "accepted".';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_booking TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The accept_booking function is now available for use.
-- It enforces:
-- - Authentication (uses auth.uid())
-- - Role check (detailer or admin only)
-- - Payment status validation (must be 'paid')
-- - Assignment check (must be unassigned)
-- - Status validation (must be 'paid' or 'offered')
-- - Row locking to prevent race conditions
-- ============================================================================

