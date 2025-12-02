-- ============================================================================
-- Availability Management Functions
-- ============================================================================
-- This migration creates RPC functions for managing detailer availability.
-- Functions:
-- 1. set_detailer_availability - Set/update availability slots
-- 2. get_detailer_availability - Get detailer's availability schedule
-- 3. find_available_detailer - Find available detailer for a booking time
-- ============================================================================

-- ============================================================================
-- Function: set_detailer_availability
-- ============================================================================
-- Sets availability slots for a detailer. Replaces existing slots for the
-- specified day_of_week if they exist, or creates new ones.
--
-- Parameters:
--   p_day_of_week - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
--   p_start_time - Start time (e.g., '09:00:00')
--   p_end_time - End time (e.g., '17:00:00')
--   p_is_active - Whether this slot is active (default true)
--
-- Returns: The created/updated availability record
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_detailer_availability(
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_is_active boolean DEFAULT true
)
RETURNS detailer_availability
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  detailer_record_id uuid;
  existing_availability detailer_availability;
  new_availability detailer_availability;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Get user role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3) Verify caller is a detailer
  IF current_role != 'detailer' THEN
    RAISE EXCEPTION 'Only detailers can set availability';
  END IF;

  -- 4) Find detailer record
  SELECT id INTO detailer_record_id
  FROM detailers
  WHERE profile_id = current_user_id
    AND is_active = true;

  IF detailer_record_id IS NULL THEN
    RAISE EXCEPTION 'Detailer profile not found or inactive';
  END IF;

  -- 5) Validate day_of_week
  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'day_of_week must be between 0 (Sunday) and 6 (Saturday)';
  END IF;

  -- 6) Validate end_time > start_time
  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'end_time must be greater than start_time';
  END IF;

  -- 7) Check if availability already exists for this day and time range
  SELECT * INTO existing_availability
  FROM detailer_availability
  WHERE detailer_id = detailer_record_id
    AND day_of_week = p_day_of_week
    AND start_time = p_start_time
    AND end_time = p_end_time;

  IF existing_availability IS NOT NULL THEN
    -- Update existing record
    UPDATE detailer_availability
    SET
      is_active = p_is_active,
      updated_at = now()
    WHERE id = existing_availability.id
    RETURNING * INTO new_availability;
  ELSE
    -- Insert new record
    INSERT INTO detailer_availability (
      detailer_id,
      day_of_week,
      start_time,
      end_time,
      is_active
    )
    VALUES (
      detailer_record_id,
      p_day_of_week,
      p_start_time,
      p_end_time,
      p_is_active
    )
    RETURNING * INTO new_availability;
  END IF;

  -- 8) Return availability record
  RETURN new_availability;
END;
$$;

COMMENT ON FUNCTION public.set_detailer_availability IS 
'Sets availability slot for a detailer. Replaces existing slot if it exists. Detailer only.';

-- ============================================================================
-- Function: get_detailer_availability
-- ============================================================================
-- Gets all availability slots for a detailer.
--
-- Parameters:
--   p_detailer_id - Optional detailer ID (defaults to current user's detailer)
--
-- Returns: JSON array of availability records
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_detailer_availability(
  p_detailer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  target_detailer_id uuid;
  result jsonb;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Get user role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3) Determine target detailer_id
  IF p_detailer_id IS NOT NULL THEN
    -- Admin can get any detailer's availability, detailer can only get their own
    IF current_role = 'admin' THEN
      target_detailer_id := p_detailer_id;
    ELSIF current_role = 'detailer' THEN
      -- Verify this is their own detailer record
      SELECT id INTO target_detailer_id
      FROM detailers
      WHERE id = p_detailer_id
        AND profile_id = current_user_id;
      
      IF target_detailer_id IS NULL THEN
        RAISE EXCEPTION 'Cannot access another detailer''s availability';
      END IF;
    ELSE
      RAISE EXCEPTION 'Only detailers and admins can view availability';
    END IF;
  ELSE
    -- No detailer_id provided, use current user's detailer record
    IF current_role != 'detailer' THEN
      RAISE EXCEPTION 'Detailer profile not found for this user';
    END IF;
    
    SELECT id INTO target_detailer_id
    FROM detailers
    WHERE profile_id = current_user_id;
    
    IF target_detailer_id IS NULL THEN
      RAISE EXCEPTION 'Detailer profile not found for this user';
    END IF;
  END IF;

  -- 4) Get availability records
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'day_of_week', day_of_week,
      'start_time', start_time,
      'end_time', end_time,
      'is_active', is_active,
      'created_at', created_at,
      'updated_at', updated_at
    )
    ORDER BY day_of_week, start_time
  ) INTO result
  FROM detailer_availability
  WHERE detailer_id = target_detailer_id;

  -- 5) Return result (empty array if no availability)
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_detailer_availability IS 
'Gets all availability slots for a detailer. Detailers can get their own, admins can get any.';

-- ============================================================================
-- Function: find_available_detailer
-- ============================================================================
-- Finds an available detailer for a given booking time.
-- Checks if any detailer has availability matching the booking's day and time.
-- Returns the detailer_id with the best match (most available hours, highest rating).
--
-- Parameters:
--   p_booking_date - The booking date
--   p_booking_time_start - The booking start time
--   p_booking_time_end - The booking end time (optional, calculated if not provided)
--   p_service_duration_minutes - Service duration in minutes (for calculating end time)
--
-- Returns: detailer_id (uuid) or NULL if no detailer available
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_available_detailer(
  p_booking_date date,
  p_booking_time_start time,
  p_booking_time_end time DEFAULT NULL,
  p_service_duration_minutes integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_day_of_week integer;
  calculated_end_time time;
  booking_start_time time;
  booking_end_time time;
  available_detailer_id uuid;
BEGIN
  -- 1) Calculate day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  -- PostgreSQL's EXTRACT(DOW FROM date) returns 0=Sunday, 1=Monday, etc.
  booking_day_of_week := EXTRACT(DOW FROM p_booking_date)::integer;

  -- 2) Calculate end time if not provided
  IF p_booking_time_end IS NULL THEN
    IF p_service_duration_minutes IS NULL THEN
      RAISE EXCEPTION 'Either booking_time_end or service_duration_minutes must be provided';
    END IF;
    calculated_end_time := (p_booking_time_start + (p_service_duration_minutes || ' minutes')::interval)::time;
  ELSE
    calculated_end_time := p_booking_time_end;
  END IF;

  booking_start_time := p_booking_time_start;
  booking_end_time := calculated_end_time;

  -- 3) Validate end time > start time
  IF booking_end_time <= booking_start_time THEN
    RAISE EXCEPTION 'Booking end time must be after start time';
  END IF;

  -- 4) Find available detailer
  -- Criteria:
  -- - Detailer is active
  -- - Availability slot is active
  -- - Matches day of week
  -- - Booking time fits within availability window (start_time <= booking_start AND end_time >= booking_end)
  -- - Detailer doesn't already have a booking at this time
  -- Order by: rating DESC, then by most available hours
  SELECT d.id INTO available_detailer_id
  FROM detailers d
  INNER JOIN detailer_availability da ON da.detailer_id = d.id
  WHERE d.is_active = true
    AND da.is_active = true
    AND da.day_of_week = booking_day_of_week
    AND da.start_time <= booking_start_time
    AND da.end_time >= booking_end_time
    -- Check that detailer doesn't have conflicting booking
    AND NOT EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.detailer_id = d.id
        AND b.scheduled_date = p_booking_date
        AND b.status NOT IN ('cancelled', 'no_show', 'completed')
        AND (
          -- Booking overlaps with requested time
          (b.scheduled_time_start < booking_end_time AND 
           COALESCE(b.scheduled_time_end, b.scheduled_time_start + INTERVAL '2 hours') > booking_start_time)
        )
    )
  ORDER BY d.rating DESC, (da.end_time - da.start_time) DESC
  LIMIT 1;

  -- 5) Return detailer_id (may be NULL if no one available)
  RETURN available_detailer_id;
END;
$$;

COMMENT ON FUNCTION public.find_available_detailer IS 
'Finds an available detailer for a booking time. Checks availability schedule and existing bookings. Returns detailer_id or NULL.';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.set_detailer_availability TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_detailer_availability TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_detailer TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Availability management functions are now available:
-- 1. set_detailer_availability - Set/update availability slots
-- 2. get_detailer_availability - Get detailer's availability schedule
-- 3. find_available_detailer - Find available detailer for booking time
-- ============================================================================

