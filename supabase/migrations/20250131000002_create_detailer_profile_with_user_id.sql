-- ============================================================================
-- Create Detailer Profile With User ID Function
-- ============================================================================
-- This migration creates a version of create_detailer_profile that accepts
-- a user_id parameter, allowing it to be called without requiring the user
-- to be authenticated (useful after signup when email confirmation is required).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_detailer_profile_with_user_id(
  p_user_id uuid,
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
  existing_detailer detailers;
  new_detailer detailers;
BEGIN
  -- 1) Validate user_id is provided
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- 2) Check if detailer record already exists for this profile
  SELECT * INTO existing_detailer
  FROM detailers
  WHERE profile_id = p_user_id;

  IF existing_detailer IS NOT NULL THEN
    RAISE EXCEPTION 'Detailer profile already exists for this user';
  END IF;

  -- 3) Validate profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 4) Set profile role to 'detailer' if not already set
  UPDATE profiles
  SET role = 'detailer'
  WHERE id = p_user_id
    AND role != 'detailer';

  -- 5) Create detailer record with is_active=false (pending admin approval)
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
    p_user_id,
    p_full_name,
    p_avatar_url,
    0.00, -- Initial rating
    0,    -- Initial review count
    p_years_experience,
    false  -- New detailers start as inactive, requiring admin approval
  )
  RETURNING * INTO new_detailer;

  -- 6) Return created detailer
  RETURN new_detailer;
END;
$$;

COMMENT ON FUNCTION public.create_detailer_profile_with_user_id IS 
'Creates a detailer record for a specific user ID. This function uses SECURITY DEFINER to bypass RLS and can be called without requiring the user to be authenticated. Useful for creating detailer profiles immediately after signup when email confirmation is required.';
