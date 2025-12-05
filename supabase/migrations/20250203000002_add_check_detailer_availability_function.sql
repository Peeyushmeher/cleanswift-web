-- ============================================================================
-- Add Function to Check Detailer Availability in Radius
-- ============================================================================
-- This migration adds a helper function to check if any detailers are
-- available within a given radius before booking creation.
-- This can be used by the UI to show "no detailer available" messages.
-- ============================================================================

-- Function to check if any detailers are available in radius
CREATE OR REPLACE FUNCTION check_detailer_availability_in_radius(
  p_booking_date date,
  p_booking_time_start time,
  p_booking_lat numeric,
  p_booking_lng numeric,
  p_booking_time_end time DEFAULT NULL,
  p_service_duration_minutes integer DEFAULT NULL,
  p_exclude_org_detailers boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  booking_day_of_week integer;
  calculated_end_time time;
  booking_start_time time;
  booking_end_time time;
  available_count integer := 0;
  nearest_detailer_distance numeric;
  result jsonb;
BEGIN
  -- 1) Validate location is provided
  IF p_booking_lat IS NULL OR p_booking_lng IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'Location coordinates are required'
    );
  END IF;

  -- 2) Calculate day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  booking_day_of_week := EXTRACT(DOW FROM p_booking_date)::integer;

  -- 3) Calculate end time if not provided
  IF p_booking_time_end IS NULL THEN
    IF p_service_duration_minutes IS NULL THEN
      RETURN jsonb_build_object(
        'available', false,
        'error', 'Either booking_time_end or service_duration_minutes must be provided'
      );
    END IF;
    calculated_end_time := (p_booking_time_start + (p_service_duration_minutes || ' minutes')::interval)::time;
  ELSE
    calculated_end_time := p_booking_time_end;
  END IF;

  booking_start_time := p_booking_time_start;
  booking_end_time := calculated_end_time;

  -- 4) Validate end time > start time
  IF booking_end_time <= booking_start_time THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'Booking end time must be after start time'
    );
  END IF;

  -- 5) Count available detailers within radius
  SELECT 
    COUNT(*),
    MIN(
      CASE WHEN d.latitude IS NOT NULL AND d.longitude IS NOT NULL
           THEN calculate_distance_km(d.latitude, d.longitude, p_booking_lat, p_booking_lng)
           ELSE NULL END
    )
  INTO available_count, nearest_detailer_distance
  FROM detailers d
  INNER JOIN detailer_availability da ON da.detailer_id = d.id
  WHERE d.is_active = true
    AND da.is_active = true
    AND da.day_of_week = booking_day_of_week
    AND da.start_time <= booking_start_time
    AND da.end_time >= booking_end_time
    -- Exclude org detailers if requested
    AND (NOT p_exclude_org_detailers OR d.organization_id IS NULL)
    -- Location filter: detailer must have location and be within service radius
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND calculate_distance_km(d.latitude, d.longitude, p_booking_lat, p_booking_lng) <= COALESCE(d.service_radius_km, 50)
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
    );

  -- 6) Build result
  result := jsonb_build_object(
    'available', available_count > 0,
    'detailer_count', available_count,
    'nearest_distance_km', nearest_detailer_distance
  );

  -- Add message if no detailers available
  IF available_count = 0 THEN
    result := result || jsonb_build_object(
      'message', 'No detailers are available in your area for this time slot. Please try a different time or location.'
    );
  END IF;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION check_detailer_availability_in_radius IS 
'Checks if any detailers are available within their service radius for a given booking.
Returns JSON with:
- available: boolean indicating if any detailers are available
- detailer_count: number of available detailers
- nearest_distance_km: distance to nearest available detailer (if any)
- message: user-friendly message if no detailers available
Parameters:
- p_booking_date: The date of the booking
- p_booking_time_start: Start time of the booking
- p_booking_time_end: End time (optional if duration provided)
- p_service_duration_minutes: Service duration (optional if end time provided)
- p_booking_lat/lng: Booking location coordinates (required)
- p_exclude_org_detailers: If true, only checks solo detailers';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_detailer_availability_in_radius TO authenticated;
GRANT EXECUTE ON FUNCTION check_detailer_availability_in_radius TO anon;

