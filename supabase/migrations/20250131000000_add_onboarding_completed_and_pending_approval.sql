-- ============================================================================
-- Add Onboarding Completed Field and Update Detailer Creation
-- ============================================================================
-- This migration:
-- 1. Adds onboarding_completed field to profiles table
-- 2. Updates create_detailer_profile to set is_active=false for new detailers
--    (requiring admin approval before they can access the dashboard)
-- ============================================================================

-- ============================================================================
-- 1. Add onboarding_completed field to profiles
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
ON profiles(onboarding_completed) 
WHERE onboarding_completed = true;

COMMENT ON COLUMN profiles.onboarding_completed IS 
'Whether the user has completed the onboarding process. Detailers must complete onboarding and be approved (is_active=true) to access the dashboard.';

-- ============================================================================
-- 2. Update create_detailer_profile function to set is_active=false
-- ============================================================================
-- New detailers will be created with is_active=false, requiring admin approval
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
    current_user_id,
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

COMMENT ON FUNCTION public.create_detailer_profile IS 
'Creates a detailer record linked to the current user''s profile. Sets profile role to ''detailer''. New detailers are created with is_active=false, requiring admin approval before they can access the dashboard.';
