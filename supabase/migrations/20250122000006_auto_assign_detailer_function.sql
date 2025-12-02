-- ============================================================================
-- Auto-Assign Detailer to Booking
-- ============================================================================
-- This migration updates the create_booking function to automatically assign
-- a detailer based on availability when a booking is created and paid.
-- 
-- Changes:
-- 1. After booking is created, check if payment_status is 'paid'
-- 2. If paid, call find_available_detailer to find matching detailer
-- 3. Automatically assign detailer and update status to 'accepted'
-- 4. If no detailer available, leave detailer_id NULL and status as 'paid'
-- ============================================================================

-- First, create a helper function that can be called after booking creation
CREATE OR REPLACE FUNCTION public.auto_assign_detailer_to_booking(
  p_booking_id uuid
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_record bookings;
  available_detailer_id uuid;
  service_duration_minutes integer;
  updated_booking bookings;
BEGIN
  -- 1) Get booking record
  SELECT * INTO booking_record
  FROM bookings
  WHERE id = p_booking_id;

  IF booking_record IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2) Only auto-assign if booking is paid and not already assigned
  IF booking_record.payment_status != 'paid' THEN
    -- Booking not paid yet, return as-is
    RETURN booking_record;
  END IF;

  IF booking_record.detailer_id IS NOT NULL THEN
    -- Already assigned, return as-is
    RETURN booking_record;
  END IF;

  -- 3) Get service duration for calculating end time
  SELECT duration_minutes INTO service_duration_minutes
  FROM services
  WHERE id = booking_record.service_id;

  -- 4) Find available detailer
  SELECT find_available_detailer(
    p_booking_date := booking_record.scheduled_date,
    p_booking_time_start := booking_record.scheduled_time_start,
    p_booking_time_end := booking_record.scheduled_time_end,
    p_service_duration_minutes := service_duration_minutes
  ) INTO available_detailer_id;

  -- 5) If detailer found, assign booking
  IF available_detailer_id IS NOT NULL THEN
    UPDATE bookings
    SET
      detailer_id = available_detailer_id,
      status = 'accepted',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO updated_booking;
    
    RETURN updated_booking;
  ELSE
    -- No detailer available, leave unassigned
    -- Status remains 'paid' or 'offered' (can be changed by admin later)
    RETURN booking_record;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.auto_assign_detailer_to_booking IS 
'Automatically assigns an available detailer to a paid booking based on availability schedule. Returns updated booking.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.auto_assign_detailer_to_booking TO authenticated;

-- ============================================================================
-- Note: Integration with create_booking
-- ============================================================================
-- The create_booking function should call this after creating a booking
-- if payment_status is 'paid'. Alternatively, this can be called by:
-- 1. Stripe webhook after payment succeeds
-- 2. A trigger on bookings table when payment_status changes to 'paid'
-- 3. Manually by admin
--
-- For now, we'll add a trigger to auto-assign when payment_status becomes 'paid'
-- ============================================================================

-- Create trigger function to auto-assign when payment becomes 'paid'
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_detailer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only trigger if payment_status changed to 'paid' and detailer_id is NULL
  IF NEW.payment_status = 'paid' 
     AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')
     AND NEW.detailer_id IS NULL THEN
    -- Auto-assign detailer (don't wait for result, fire and forget)
    PERFORM public.auto_assign_detailer_to_booking(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS auto_assign_detailer_on_payment ON bookings;
CREATE TRIGGER auto_assign_detailer_on_payment
  AFTER UPDATE OF payment_status ON bookings
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND NEW.detailer_id IS NULL)
  EXECUTE FUNCTION trigger_auto_assign_detailer();

-- Also trigger on INSERT if booking is created with payment_status = 'paid'
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_detailer_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If booking is created with payment_status = 'paid' and no detailer, auto-assign
  IF NEW.payment_status = 'paid' AND NEW.detailer_id IS NULL THEN
    PERFORM public.auto_assign_detailer_to_booking(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_detailer_on_insert ON bookings;
CREATE TRIGGER auto_assign_detailer_on_insert
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND NEW.detailer_id IS NULL)
  EXECUTE FUNCTION trigger_auto_assign_detailer_on_insert();

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Auto-assignment is now enabled:
-- 1. auto_assign_detailer_to_booking function finds and assigns detailer
-- 2. Trigger automatically calls this when payment_status becomes 'paid'
-- 3. Works for both new bookings and updated bookings
-- ============================================================================

