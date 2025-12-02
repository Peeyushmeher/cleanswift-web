-- ============================================================================
-- Detailer Management Functions
-- ============================================================================
-- This migration creates RPC functions for managing detailer profiles.
-- These functions allow:
-- 1. Creating a detailer record linked to a profile
-- 2. Updating detailer information
-- 3. Getting detailer record by profile
--
-- All functions use auth.uid() internally and validate permissions.
-- ============================================================================

-- ============================================================================
-- Function: create_detailer_profile
-- ============================================================================
-- Creates a detailer record linked to the current user's profile.
-- Also sets the profile role to 'detailer' if not already set.
--
-- Parameters:
--   p_full_name - Detailer's full name
--   p_years_experience - Years of experience
--   p_avatar_url - Optional avatar URL
--
-- Returns: The created detailer record
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_detailer_profile(
  p_full_name text,
  p_years_experience integer,
  p_avatar_url text DEFAULT NULL
)
RETURNS detailers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  existing_detailer detailers;
  new_detailer detailers;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Check if detailer record already exists for this profile
  SELECT * INTO existing_detailer
  FROM detailers
  WHERE profile_id = current_user_id;

  IF existing_detailer IS NOT NULL THEN
    RAISE EXCEPTION 'Detailer profile already exists for this user';
  END IF;

  -- 3) Validate profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = current_user_id) THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 4) Set profile role to 'detailer' if not already set
  UPDATE profiles
  SET role = 'detailer'
  WHERE id = current_user_id
    AND role != 'detailer';

  -- 5) Create detailer record
  INSERT INTO detailers (
    profile_id,
    full_name,
    avatar_url,
    rating,
    review_count,
    years_experience,
    is_active
  )
  VALUES (
    current_user_id,
    p_full_name,
    p_avatar_url,
    0.00, -- Initial rating
    0,    -- Initial review count
    p_years_experience,
    true
  )
  RETURNING * INTO new_detailer;

  -- 6) Return created detailer
  RETURN new_detailer;
END;
$$;

COMMENT ON FUNCTION public.create_detailer_profile IS 
'Creates a detailer record linked to the current user''s profile. Sets profile role to ''detailer''. Returns the created detailer record.';

-- ============================================================================
-- Function: update_detailer_profile
-- ============================================================================
-- Updates detailer information. Only the detailer themselves or an admin can update.
--
-- Parameters:
--   p_detailer_id - The detailer record ID to update (optional, defaults to current user's detailer)
--   p_full_name - Optional new full name
--   p_years_experience - Optional new years of experience
--   p_avatar_url - Optional new avatar URL
--   p_is_active - Optional active status (admins only)
--
-- Returns: The updated detailer record
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_detailer_profile(
  p_detailer_id uuid DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_years_experience integer DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS detailers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  target_detailer_id uuid;
  updated_detailer detailers;
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
    -- Admin can update any detailer, detailer can only update themselves
    IF current_role = 'admin' THEN
      target_detailer_id := p_detailer_id;
    ELSIF current_role = 'detailer' THEN
      -- Detailer can only update their own record
      SELECT id INTO target_detailer_id
      FROM detailers
      WHERE id = p_detailer_id
        AND profile_id = current_user_id;
      
      IF target_detailer_id IS NULL THEN
        RAISE EXCEPTION 'Cannot update another detailer''s profile';
      END IF;
    ELSE
      RAISE EXCEPTION 'Only detailers and admins can update detailer profiles';
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

  -- 4) Validate is_active can only be changed by admins
  IF p_is_active IS NOT NULL AND current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change detailer active status';
  END IF;

  -- 5) Update detailer record
  UPDATE detailers
  SET
    full_name = COALESCE(p_full_name, full_name),
    years_experience = COALESCE(p_years_experience, years_experience),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = target_detailer_id
  RETURNING * INTO updated_detailer;

  IF updated_detailer IS NULL THEN
    RAISE EXCEPTION 'Detailer not found';
  END IF;

  -- 6) Return updated detailer
  RETURN updated_detailer;
END;
$$;

COMMENT ON FUNCTION public.update_detailer_profile IS 
'Updates detailer information. Detailers can update their own profile. Admins can update any detailer and change active status.';

-- ============================================================================
-- Function: get_detailer_by_profile
-- ============================================================================
-- Gets the detailer record for a given profile ID.
-- Users can get their own detailer record, admins can get any.
--
-- Parameters:
--   p_profile_id - Profile ID (optional, defaults to current user)
--
-- Returns: The detailer record or NULL if not found
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_detailer_by_profile(
  p_profile_id uuid DEFAULT NULL
)
RETURNS detailers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  target_profile_id uuid;
  detailer_record detailers;
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

  -- 3) Determine target profile_id
  IF p_profile_id IS NOT NULL THEN
    -- Admin can get any detailer, user can only get their own
    IF current_role = 'admin' THEN
      target_profile_id := p_profile_id;
    ELSIF p_profile_id = current_user_id THEN
      target_profile_id := current_user_id;
    ELSE
      RAISE EXCEPTION 'Cannot access another user''s detailer profile';
    END IF;
  ELSE
    -- No profile_id provided, use current user
    target_profile_id := current_user_id;
  END IF;

  -- 4) Get detailer record
  SELECT * INTO detailer_record
  FROM detailers
  WHERE profile_id = target_profile_id;

  -- 5) Return detailer (may be NULL if not found)
  RETURN detailer_record;
END;
$$;

COMMENT ON FUNCTION public.get_detailer_by_profile IS 
'Gets the detailer record for a profile. Users can get their own, admins can get any. Returns NULL if detailer record does not exist.';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.create_detailer_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_detailer_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_detailer_by_profile TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Detailer management functions are now available:
-- 1. create_detailer_profile - Create detailer record linked to profile
-- 2. update_detailer_profile - Update detailer information
-- 3. get_detailer_by_profile - Get detailer record by profile
-- ============================================================================

