-- ============================================================================
-- Create Profile After Signup Function
-- ============================================================================
-- This migration creates a function to create a user profile after signup
-- without requiring email confirmation. This is needed because email
-- confirmation is required before sign-in, but we need to create the profile
-- immediately after signup to proceed with onboarding.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_profile_after_signup(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update profile
  INSERT INTO profiles (
    id,
    email,
    full_name,
    phone,
    role
  )
  VALUES (
    p_user_id,
    p_email,
    p_full_name,
    p_phone,
    'user' -- Will be updated to 'detailer' by create_detailer_profile
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;
END;
$$;

COMMENT ON FUNCTION public.create_profile_after_signup IS 
'Creates or updates a user profile after signup. This function uses SECURITY DEFINER to bypass RLS, allowing profile creation even when the user has not confirmed their email yet.';
