-- ============================================================================
-- Add Date Range Support to Detailer Days Off
-- ============================================================================
-- This migration adds support for date ranges in the detailer_days_off table.
-- Detailers can now set both single dates and date ranges (e.g., vacation periods).
-- 
-- Changes:
-- 1. Add end_date column (nullable - if NULL, it's a single date)
-- 2. Update unique constraint to allow overlapping ranges
-- 3. Update RPC functions to handle date ranges
-- 4. Update find_available_detailer to check date ranges
-- ============================================================================

-- Step 1: Add end_date column
ALTER TABLE detailer_days_off
ADD COLUMN IF NOT EXISTS end_date date;

-- Add comment
COMMENT ON COLUMN detailer_days_off.end_date IS 
'End date for date range. If NULL, this is a single date day off. If set, represents a range from date to end_date (inclusive).';

-- Step 2: Add constraint to ensure end_date >= date if both are set
ALTER TABLE detailer_days_off
ADD CONSTRAINT check_end_date_after_start 
CHECK (end_date IS NULL OR end_date >= date);

-- Step 3: Drop the old unique constraint (detailer_id, date) since we now support ranges
ALTER TABLE detailer_days_off
DROP CONSTRAINT IF EXISTS detailer_days_off_detailer_id_date_key;

-- Step 4: Create a new index for efficient range queries
CREATE INDEX IF NOT EXISTS idx_detailer_days_off_date_range 
ON detailer_days_off(detailer_id, date, end_date) 
WHERE is_active = true;

-- ============================================================================
-- Update Function: add_detailer_day_off
-- ============================================================================
-- Now supports both single dates and date ranges
-- Parameters:
--   p_date - Start date (required)
--   p_end_date - End date (optional, if NULL it's a single date)
--   p_reason - Optional reason
-- ============================================================================

-- Drop the old version first (2 parameters)
DROP FUNCTION IF EXISTS public.add_detailer_day_off(date, text);

CREATE OR REPLACE FUNCTION public.add_detailer_day_off(
  p_date date,
  p_end_date date DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS detailer_days_off
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_role user_role_enum;
  detailer_record_id uuid;
  new_day_off detailer_days_off;
  date_to_check date;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Get user role
  SELECT role INTO user_role
  FROM profiles
  WHERE id = current_user_id;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3) Verify caller is a detailer
  IF user_role::text != 'detailer' THEN
    RAISE EXCEPTION 'Only detailers can add days off';
  END IF;

  -- 4) Find detailer record
  SELECT id INTO detailer_record_id
  FROM detailers
  WHERE profile_id = current_user_id
    AND is_active = true;

  IF detailer_record_id IS NULL THEN
    RAISE EXCEPTION 'Detailer profile not found or inactive';
  END IF;

  -- 5) Validate dates
  IF p_end_date IS NOT NULL AND p_end_date < p_date THEN
    RAISE EXCEPTION 'End date must be after or equal to start date';
  END IF;

  -- Use start date for past date check
  date_to_check := p_date;
  IF date_to_check < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot add days off for past dates';
  END IF;

  -- 6) Insert or update day off
  -- First, deactivate any overlapping ranges (for both single dates and ranges)
  UPDATE detailer_days_off
  SET is_active = false, updated_at = now()
  WHERE detailer_id = detailer_record_id
    AND is_active = true
    AND (
      -- Existing range overlaps with new range/date
      -- Case 1: Existing single date matches new single date
      (p_end_date IS NULL AND end_date IS NULL AND date = p_date)
      OR
      -- Case 2: Existing range overlaps with new single date
      (p_end_date IS NULL AND date <= p_date AND (end_date IS NULL OR end_date >= p_date))
      OR
      -- Case 3: Existing single date is within new range
      (p_end_date IS NOT NULL AND end_date IS NULL AND date >= p_date AND date <= p_end_date)
      OR
      -- Case 4: Existing range overlaps with new range
      (p_end_date IS NOT NULL AND date <= p_end_date AND (end_date IS NULL OR end_date >= p_date))
    );
  
  -- Insert new day off or range
  INSERT INTO detailer_days_off (
    detailer_id,
    date,
    end_date,
    reason,
    is_active
  )
  VALUES (
    detailer_record_id,
    p_date,
    p_end_date,
    p_reason,
    true
  )
  RETURNING * INTO new_day_off;

  -- 7) Return day off record
  RETURN new_day_off;
END;
$$;

COMMENT ON FUNCTION public.add_detailer_day_off IS 
'Adds a day off or date range for the current detailer. 
If p_end_date is NULL, creates a single date day off.
If p_end_date is provided, creates a date range from p_date to p_end_date (inclusive).
Overlapping ranges will be deactivated before inserting the new range.';

-- ============================================================================
-- Update Function: remove_detailer_day_off
-- ============================================================================
-- Now supports removing by date (will remove any day off that includes that date)
-- Parameters:
--   p_date - The date to remove (will remove any day off or range that includes this date)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_detailer_day_off(
  p_date date
)
RETURNS detailer_days_off
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_role user_role_enum;
  detailer_record_id uuid;
  updated_day_off detailer_days_off;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Get user role
  SELECT role INTO user_role
  FROM profiles
  WHERE id = current_user_id;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3) Verify caller is a detailer
  IF user_role::text != 'detailer' THEN
    RAISE EXCEPTION 'Only detailers can remove days off';
  END IF;

  -- 4) Find detailer record
  SELECT id INTO detailer_record_id
  FROM detailers
  WHERE profile_id = current_user_id
    AND is_active = true;

  IF detailer_record_id IS NULL THEN
    RAISE EXCEPTION 'Detailer profile not found or inactive';
  END IF;

  -- 5) Update day off to inactive (handles both single dates and ranges)
  UPDATE detailer_days_off
  SET
    is_active = false,
    updated_at = now()
  WHERE detailer_id = detailer_record_id
    AND is_active = true
    AND date <= p_date
    AND (end_date IS NULL OR end_date >= p_date)
  RETURNING * INTO updated_day_off;

  IF updated_day_off IS NULL THEN
    RAISE EXCEPTION 'Day off not found for this date';
  END IF;

  -- 6) Return updated day off record
  RETURN updated_day_off;
END;
$$;

COMMENT ON FUNCTION public.remove_detailer_day_off IS 
'Removes (deactivates) a day off or date range that includes the specified date.';

-- ============================================================================
-- Update Function: get_detailer_days_off
-- ============================================================================
-- Returns days off including date ranges
-- ============================================================================

-- The get_detailer_days_off function should already work with the new schema
-- since it just returns the records. But let's make sure it returns the end_date field.

-- Check if function exists and update if needed
DO $$
BEGIN
  -- Function should already exist, but we'll ensure it returns end_date
  -- The existing function should work fine since it returns all columns
  NULL; -- No changes needed, existing function will return end_date automatically
END $$;

-- ============================================================================
-- Update Function: find_available_detailer
-- ============================================================================
-- Update to check date ranges instead of just single dates
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
  -- - Booking date is NOT in any active day off or date range
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
    -- Exclude if detailer has a day off on this date (handles both single dates and ranges)
    AND NOT EXISTS (
      SELECT 1
      FROM detailer_days_off ddo
      WHERE ddo.detailer_id = d.id
        AND ddo.is_active = true
        AND ddo.date <= p_booking_date
        AND (ddo.end_date IS NULL OR ddo.end_date >= p_booking_date)
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
Excludes detailers with lunch breaks during the booking time and days off (including date ranges) on the booking date.
Parameters:
- p_booking_date: The date of the booking
- p_booking_time_start: Start time of the booking
- p_booking_time_end: End time (optional if duration provided)
- p_service_duration_minutes: Service duration (optional if end time provided)
- p_booking_lat/lng: Booking location for distance filtering (optional)
- p_exclude_org_detailers: If true, only returns solo detailers (for auto-assign)
Returns the detailer_id or NULL if no one is available.';

-- ============================================================================
-- Update Function: check_detailer_availability_in_radius
-- ============================================================================
-- Update to check date ranges for days off
-- ============================================================================

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
    -- Location filter: detailer must have location and be within service radius
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND calculate_distance_km(d.latitude, d.longitude, p_booking_lat, p_booking_lng) <= COALESCE(d.service_radius_km, 50)
    -- Exclude if detailer has a day off on this date (handles both single dates and ranges)
    AND NOT EXISTS (
      SELECT 1
      FROM detailer_days_off ddo
      WHERE ddo.detailer_id = d.id
        AND ddo.is_active = true
        AND ddo.date <= p_booking_date
        AND (ddo.end_date IS NULL OR ddo.end_date >= p_booking_date)
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
Excludes detailers with lunch breaks during the booking time and days off (including date ranges) on the booking date.
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

-- ============================================================================
-- Migration Complete
-- ============================================================================

