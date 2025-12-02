-- ============================================================================
-- Auto-Assign Booking Function and Trigger
-- ============================================================================
-- This migration creates:
-- 1. auto_assign_booking() - RPC to find and assign a detailer to a booking
-- 2. auto_assign_booking_trigger() - Trigger function called when booking becomes paid
-- 3. Trigger on bookings table
--
-- Flow:
-- - Only auto-assigns to SOLO detailers (org_id IS NULL)
-- - Organization bookings stay unassigned for dispatcher to handle
-- - Sets status to 'offered' (detailer must accept)
-- ============================================================================

-- Create the main auto_assign_booking function
CREATE OR REPLACE FUNCTION auto_assign_booking(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_booking RECORD;
  v_service_duration integer;
  v_available_detailer_id uuid;
BEGIN
  -- 1) Get booking details
  SELECT 
    b.id,
    b.scheduled_date,
    b.scheduled_time_start,
    b.scheduled_time_end,
    b.latitude,
    b.longitude,
    b.detailer_id,
    b.organization_id,
    b.status,
    b.service_id,
    s.duration_minutes
  INTO v_booking
  FROM bookings b
  LEFT JOIN services s ON b.service_id = s.id
  WHERE b.id = p_booking_id;

  -- 2) Validate booking exists
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  -- 3) Skip if already assigned
  IF v_booking.detailer_id IS NOT NULL THEN
    RETURN v_booking.detailer_id;
  END IF;

  -- 4) Skip if this is an organization booking (dispatcher assigns manually)
  IF v_booking.organization_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- 5) Skip if not in correct status (must be 'paid')
  IF v_booking.status != 'paid' THEN
    RETURN NULL;
  END IF;

  -- 6) Get service duration
  v_service_duration := COALESCE(v_booking.duration_minutes, 120); -- Default 2 hours

  -- 7) Find available detailer (solo only)
  v_available_detailer_id := find_available_detailer(
    p_booking_date := v_booking.scheduled_date,
    p_booking_time_start := v_booking.scheduled_time_start,
    p_booking_time_end := v_booking.scheduled_time_end,
    p_service_duration_minutes := v_service_duration,
    p_booking_lat := v_booking.latitude,
    p_booking_lng := v_booking.longitude,
    p_exclude_org_detailers := true  -- Only solo detailers for auto-assign
  );

  -- 8) If detailer found, assign and update status to 'offered'
  IF v_available_detailer_id IS NOT NULL THEN
    UPDATE bookings
    SET 
      detailer_id = v_available_detailer_id,
      status = 'offered',
      updated_at = now()
    WHERE id = p_booking_id;
  END IF;

  -- 9) Return the assigned detailer_id (or NULL if none found)
  RETURN v_available_detailer_id;
END;
$$;

COMMENT ON FUNCTION auto_assign_booking IS
'Automatically assigns a booking to an available solo detailer.
- Only assigns to solo detailers (not organization members)
- Only works for bookings in "paid" status with no detailer assigned
- Sets status to "offered" so detailer must accept
- Returns the assigned detailer_id or NULL if no one available';

-- Create trigger function
CREATE OR REPLACE FUNCTION auto_assign_booking_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only trigger when:
  -- 1. Status changed to 'paid'
  -- 2. No detailer assigned yet
  -- 3. Not an organization booking
  IF NEW.status = 'paid' 
     AND (OLD.status IS NULL OR OLD.status != 'paid')
     AND NEW.detailer_id IS NULL 
     AND NEW.organization_id IS NULL 
  THEN
    PERFORM auto_assign_booking(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_assign_booking_trigger IS
'Trigger function that auto-assigns solo bookings when status becomes paid.';

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_on_paid ON bookings;

CREATE TRIGGER trigger_auto_assign_on_paid
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION auto_assign_booking_trigger();

-- Also trigger on INSERT (in case booking is created with status='paid')
DROP TRIGGER IF EXISTS trigger_auto_assign_on_insert ON bookings;

CREATE TRIGGER trigger_auto_assign_on_insert
AFTER INSERT ON bookings
FOR EACH ROW
WHEN (NEW.status = 'paid' AND NEW.detailer_id IS NULL AND NEW.organization_id IS NULL)
EXECUTE FUNCTION auto_assign_booking_trigger();

COMMENT ON TRIGGER trigger_auto_assign_on_paid ON bookings IS
'Triggers auto-assignment when a booking status changes to paid.';

COMMENT ON TRIGGER trigger_auto_assign_on_insert ON bookings IS
'Triggers auto-assignment when a booking is inserted with paid status.';

