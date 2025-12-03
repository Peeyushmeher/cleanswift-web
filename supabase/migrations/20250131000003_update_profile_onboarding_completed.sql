-- ============================================================================
-- Update Profile Onboarding Completed Function
-- ============================================================================
-- This migration creates a function to update the onboarding_completed flag
-- without requiring the user to be authenticated (useful after signup when
-- email confirmation is required).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_profile_onboarding_completed(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update onboarding_completed flag
  UPDATE profiles
  SET onboarding_completed = true
  WHERE id = p_user_id;
  
  -- Raise exception if no rows were updated (user doesn't exist)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.update_profile_onboarding_completed IS 
'Updates the onboarding_completed flag for a user profile. This function uses SECURITY DEFINER to bypass RLS and can be called without requiring the user to be authenticated.';
