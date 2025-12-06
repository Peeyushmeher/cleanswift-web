-- ============================================================================
-- Fix Availability Update Constraint Error - Delete Then Insert Approach
-- ============================================================================
-- The previous approach tried to UPDATE existing records, which could fail
-- if the new times matched another existing record's times, causing unique
-- constraint violations.
--
-- Solution: Since we only want ONE record per day, delete all existing
-- records for the day first, then insert the new one. This is simpler,
-- more reliable, and guarantees no constraint violations.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_detailer_availability(
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_is_active boolean DEFAULT true,
  p_lunch_start_time time DEFAULT NULL,
  p_lunch_end_time time DEFAULT NULL
)
RETURNS detailer_availability
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_role user_role_enum;
  detailer_record_id uuid;
  new_availability detailer_availability;
  profile_exists boolean;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated - auth.uid() returned NULL. Please ensure you are logged in and your session is valid.';
  END IF;

  -- 2) Get user role - use explicit query with row existence check
  SELECT role, true INTO user_role, profile_exists
  FROM profiles
  WHERE id = current_user_id;

  IF NOT profile_exists OR user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %. Please ensure your profile exists in the profiles table.', current_user_id;
  END IF;

  -- 3) Verify caller is a detailer
  IF user_role::text != 'detailer' THEN
    RAISE EXCEPTION 'Only detailers can set availability. Current role: %, user_id: %', user_role::text, current_user_id;
  END IF;

  -- 4) Find detailer record
  SELECT id INTO detailer_record_id
  FROM detailers
  WHERE profile_id = current_user_id
    AND is_active = true;

  IF detailer_record_id IS NULL THEN
    RAISE EXCEPTION 'Detailer profile not found or inactive for user_id: %. Please ensure your detailer record exists and is active.', current_user_id;
  END IF;

  -- 5) Validate day_of_week
  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'day_of_week must be between 0 (Sunday) and 6 (Saturday)';
  END IF;

  -- 6) Validate end_time > start_time
  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'end_time must be greater than start_time';
  END IF;

  -- 7) Validate lunch break times if provided
  IF (p_lunch_start_time IS NOT NULL OR p_lunch_end_time IS NOT NULL) THEN
    IF p_lunch_start_time IS NULL OR p_lunch_end_time IS NULL THEN
      RAISE EXCEPTION 'Both lunch_start_time and lunch_end_time must be provided together';
    END IF;
    
    IF p_lunch_end_time <= p_lunch_start_time THEN
      RAISE EXCEPTION 'lunch_end_time must be greater than lunch_start_time';
    END IF;
    
    -- Validate lunch break is within availability window
    IF p_lunch_start_time < p_start_time OR p_lunch_end_time > p_end_time THEN
      RAISE EXCEPTION 'Lunch break must be within availability window';
    END IF;
  END IF;

  -- 8) Delete ALL existing records for this day
  -- This ensures we only have one record per day and avoids constraint violations
  DELETE FROM detailer_availability
  WHERE detailer_id = detailer_record_id
    AND day_of_week = p_day_of_week;

  -- 9) Insert the new record
  INSERT INTO detailer_availability (
    detailer_id,
    day_of_week,
    start_time,
    end_time,
    is_active,
    lunch_start_time,
    lunch_end_time
  )
  VALUES (
    detailer_record_id,
    p_day_of_week,
    p_start_time,
    p_end_time,
    p_is_active,
    p_lunch_start_time,
    p_lunch_end_time
  )
  RETURNING * INTO new_availability;

  -- 10) Return availability record
  RETURN new_availability;
END;
$$;

COMMENT ON FUNCTION public.set_detailer_availability IS 
'Sets availability slot for a detailer with optional lunch break. Deletes all existing records for the day first, then inserts the new one. This ensures only one record per day and avoids constraint violations. Detailer only.';

