-- ============================================================================
-- Fix RPC Variable Name Conflict with PostgreSQL Built-in
-- ============================================================================
-- The RPC functions used a variable named `current_role` which conflicts with
-- PostgreSQL's built-in `current_role` system function that returns the 
-- current database role ('postgres' in SECURITY DEFINER functions).
-- 
-- This caused the role lookup to return 'postgres' instead of the actual
-- user role from the profiles table.
--
-- Solution: Rename `current_role` to `user_role` in all functions.
-- ============================================================================

-- ============================================================================
-- Update Function: set_detailer_availability
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
  user_role user_role_enum;  -- Renamed from current_role to avoid conflict
  detailer_record_id uuid;
  existing_availability detailer_availability;
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

  -- 8) Check if availability already exists for this day and time range
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
      lunch_start_time = p_lunch_start_time,
      lunch_end_time = p_lunch_end_time,
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
  END IF;

  -- 9) Return availability record
  RETURN new_availability;
END;
$$;

-- ============================================================================
-- Update Function: get_detailer_availability
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
  user_role user_role_enum;  -- Renamed from current_role to avoid conflict
  target_detailer_id uuid;
  result jsonb;
  profile_exists boolean;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Get user role - use explicit query with row existence check
  SELECT role, true INTO user_role, profile_exists
  FROM profiles
  WHERE id = current_user_id;

  IF NOT profile_exists OR user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3) Determine target detailer_id
  IF p_detailer_id IS NOT NULL THEN
    -- Admin can get any detailer's availability, detailer can only get their own
    IF user_role::text = 'admin' THEN
      target_detailer_id := p_detailer_id;
    ELSIF user_role::text = 'detailer' THEN
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
    IF user_role::text != 'detailer' THEN
      RAISE EXCEPTION 'Detailer profile not found for this user';
    END IF;
    
    SELECT id INTO target_detailer_id
    FROM detailers
    WHERE profile_id = current_user_id;
    
    IF target_detailer_id IS NULL THEN
      RAISE EXCEPTION 'Detailer profile not found for this user';
    END IF;
  END IF;

  -- 4) Get availability records with lunch breaks
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'day_of_week', day_of_week,
      'start_time', start_time,
      'end_time', end_time,
      'lunch_start_time', lunch_start_time,
      'lunch_end_time', lunch_end_time,
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

-- ============================================================================
-- Update Function: get_detailer_days_off
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_detailer_days_off(
  p_detailer_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_role user_role_enum;  -- Renamed from current_role to avoid conflict
  target_detailer_id uuid;
  filter_start_date date;
  filter_end_date date;
  result jsonb;
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

  -- 3) Determine target detailer_id
  IF p_detailer_id IS NOT NULL THEN
    -- Admin can get any detailer's days off, detailer can only get their own
    IF user_role::text = 'admin' THEN
      target_detailer_id := p_detailer_id;
    ELSIF user_role::text = 'detailer' THEN
      -- Verify this is their own detailer record
      SELECT id INTO target_detailer_id
      FROM detailers
      WHERE id = p_detailer_id
        AND profile_id = current_user_id;
      
      IF target_detailer_id IS NULL THEN
        RAISE EXCEPTION 'Cannot access another detailer''s days off. Provided detailer_id: %, current_user_id: %', p_detailer_id, current_user_id;
      END IF;
    ELSE
      RAISE EXCEPTION 'Only detailers and admins can view days off. Current role: %, user_id: %', user_role::text, current_user_id;
    END IF;
  ELSE
    -- No detailer_id provided, use current user's detailer record
    IF user_role::text != 'detailer' THEN
      RAISE EXCEPTION 'Detailer profile not found for this user. Current role: %, user_id: %', user_role::text, current_user_id;
    END IF;
    
    SELECT id INTO target_detailer_id
    FROM detailers
    WHERE profile_id = current_user_id;
    
    IF target_detailer_id IS NULL THEN
      RAISE EXCEPTION 'Detailer profile not found for this user. user_id: %. Please ensure your detailer record exists.', current_user_id;
    END IF;
  END IF;

  -- 4) Set default date range if not provided
  filter_start_date := COALESCE(p_start_date, CURRENT_DATE);
  filter_end_date := COALESCE(p_end_date, filter_start_date + INTERVAL '1 year');

  -- 5) Get days off records
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'date', date,
      'reason', reason,
      'is_active', is_active,
      'created_at', created_at,
      'updated_at', updated_at
    )
    ORDER BY date
  ) INTO result
  FROM detailer_days_off
  WHERE detailer_id = target_detailer_id
    AND date >= filter_start_date
    AND date <= filter_end_date
    AND is_active = true;

  -- 6) Return result (empty array if no days off)
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- Update Function: add_detailer_day_off
-- ============================================================================
-- Also fix this function for consistency

CREATE OR REPLACE FUNCTION public.add_detailer_day_off(
  p_date date,
  p_reason text DEFAULT NULL
)
RETURNS detailer_days_off
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_role user_role_enum;  -- Renamed from current_role to avoid conflict
  detailer_record_id uuid;
  new_day_off detailer_days_off;
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

  -- 5) Validate date is not in the past (optional, but good practice)
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot add days off for past dates';
  END IF;

  -- 6) Insert or update day off (using ON CONFLICT to handle duplicates)
  INSERT INTO detailer_days_off (
    detailer_id,
    date,
    reason,
    is_active
  )
  VALUES (
    detailer_record_id,
    p_date,
    p_reason,
    true
  )
  ON CONFLICT (detailer_id, date)
  DO UPDATE SET
    reason = COALESCE(EXCLUDED.reason, detailer_days_off.reason),
    is_active = true,
    updated_at = now()
  RETURNING * INTO new_day_off;

  -- 7) Return day off record
  RETURN new_day_off;
END;
$$;

-- ============================================================================
-- Update Function: remove_detailer_day_off
-- ============================================================================
-- Also fix this function for consistency

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
  user_role user_role_enum;  -- Renamed from current_role to avoid conflict
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

  -- 5) Update day off to inactive
  UPDATE detailer_days_off
  SET
    is_active = false,
    updated_at = now()
  WHERE detailer_id = detailer_record_id
    AND date = p_date
  RETURNING * INTO updated_day_off;

  IF updated_day_off IS NULL THEN
    RAISE EXCEPTION 'Day off not found for this date';
  END IF;

  -- 6) Return updated day off record
  RETURN updated_day_off;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.set_detailer_availability IS 
'Sets availability slot for a detailer with optional lunch break. Replaces existing slot if it exists. Detailer only.';

COMMENT ON FUNCTION public.get_detailer_availability IS 
'Gets all availability slots for a detailer including lunch breaks. Detailers can get their own, admins can get any.';

COMMENT ON FUNCTION public.get_detailer_days_off IS 
'Gets days off for a detailer within an optional date range. Detailers can get their own, admins can get any.';

COMMENT ON FUNCTION public.add_detailer_day_off IS 
'Adds a day off for the current detailer. If the day off already exists, it will be reactivated.';

COMMENT ON FUNCTION public.remove_detailer_day_off IS 
'Removes (deactivates) a day off for the current detailer.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- All availability-related RPC functions have been updated to use `user_role`
-- instead of `current_role` to avoid conflict with PostgreSQL's built-in
-- `current_role` system function.
-- ============================================================================

