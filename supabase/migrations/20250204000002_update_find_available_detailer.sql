-- ============================================================================
-- Update find_available_detailer to Exclude Lunch Breaks and Days Off
-- ============================================================================
-- This migration updates the find_available_detailer function to:
-- 1. Exclude detailers who have lunch breaks during the requested booking time
-- 2. Exclude detailers who have days off on the requested booking date
-- ============================================================================

CREATE OR REPLACE FUNCTION find_available_detailer(
  p_booking_date date,
  p_booking_time_start time,
  p_booking_time_end time DEFAULT NULL,
  p_service_duration_minutes integer DEFAULT NULL,
  p_booking_lat numeric DEFAULT NULL,
  p_booking_lng numeric DEFAULT NULL,
  p_exclude_org_detailers boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  booking_day_of_week integer;
  calculated_end_time time;
  booking_start_time time;
  booking_end_time time;
  available_detailer_id uuid;
BEGIN
  -- 1) Calculate day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
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
  -- - If p_exclude_org_detailers, only solo detailers (organization_id IS NULL)
  -- - Availability slot is active
  -- - Matches day of week
  -- - Booking time fits within availability window
  -- - Booking time does NOT overlap with lunch break (if lunch break exists)
  -- - Booking date is NOT in detailer_days_off table
  -- - Detailer doesn't already have a booking at this time
  -- - If location provided, detailer must be within service radius
  -- Order by: distance (if location provided), then rating DESC, then availability hours
  SELECT d.id INTO available_detailer_id
  FROM detailers d
  INNER JOIN detailer_availability da ON da.detailer_id = d.id
  WHERE d.is_active = true
    AND da.is_active = true
    AND da.day_of_week = booking_day_of_week
    AND da.start_time <= booking_start_time
    AND da.end_time >= booking_end_time
    -- Exclude org detailers if requested (for auto-assign to solo detailers only)
    AND (NOT p_exclude_org_detailers OR d.organization_id IS NULL)
    -- Exclude if booking overlaps with lunch break
    AND (
      da.lunch_start_time IS NULL 
      OR da.lunch_end_time IS NULL
      OR NOT (
        -- Booking overlaps with lunch break if:
        -- Booking starts before lunch ends AND booking ends after lunch starts
        booking_start_time < da.lunch_end_time 
        AND booking_end_time > da.lunch_start_time
      )
    )
    -- Exclude if detailer has a day off on this date
    AND NOT EXISTS (
      SELECT 1
      FROM detailer_days_off ddo
      WHERE ddo.detailer_id = d.id
        AND ddo.date = p_booking_date
        AND ddo.is_active = true
    )
    -- Location filter: if booking has location AND detailer has location, check distance
    AND (
      p_booking_lat IS NULL 
      OR p_booking_lng IS NULL 
      OR d.latitude IS NULL 
      OR d.longitude IS NULL
      OR calculate_distance_km(d.latitude, d.longitude, p_booking_lat, p_booking_lng) <= COALESCE(d.service_radius_km, 50)
    )
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
  ORDER BY 
    -- Prefer closer detailers if location is provided
    CASE WHEN p_booking_lat IS NOT NULL AND p_booking_lng IS NOT NULL AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
         THEN calculate_distance_km(d.latitude, d.longitude, p_booking_lat, p_booking_lng)
         ELSE 9999 END ASC,
    d.rating DESC, 
    (da.end_time - da.start_time) DESC
  LIMIT 1;

  -- 5) Return detailer_id (may be NULL if no one available)
  RETURN available_detailer_id;
END;
$$;

COMMENT ON FUNCTION find_available_detailer IS 
'Finds an available detailer for a booking based on schedule, location, and conflicts.
Excludes detailers with lunch breaks during the booking time and days off on the booking date.
Parameters:
- p_booking_date: The date of the booking
- p_booking_time_start: Start time of the booking
- p_booking_time_end: End time (optional if duration provided)
- p_service_duration_minutes: Service duration (optional if end time provided)
- p_booking_lat/lng: Booking location for distance filtering (optional)
- p_exclude_org_detailers: If true, only returns solo detailers (for auto-assign)
Returns the detailer_id or NULL if no one is available.';

