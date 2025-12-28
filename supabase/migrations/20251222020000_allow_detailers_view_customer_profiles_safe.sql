-- ============================================================================
-- Allow Detailers to View Customer Profiles for Assigned Bookings (Safe)
-- ============================================================================
-- This migration adds an RLS policy to allow detailers to view customer
-- profile information for bookings they're assigned to. It uses a SECURITY
-- DEFINER function to avoid infinite recursion issues.
--
-- The solution:
-- 1. Creates a SECURITY DEFINER function that checks if the current user
--    is a detailer assigned to a booking for the customer profile being viewed
-- 2. Creates an RLS policy that uses this function
-- 3. Avoids recursion by using SECURITY DEFINER (bypasses RLS) in the function
-- ============================================================================

-- Create a function to check if current user is a detailer assigned to
-- a booking for the given customer profile
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION is_detailer_for_customer_profile(p_customer_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's a booking where:
  -- 1. The customer (user_id) matches the profile being viewed
  -- 2. The booking is assigned to a detailer
  -- 3. That detailer is linked to the current user's profile
  -- 4. The detailer is active
  RETURN EXISTS (
    SELECT 1
    FROM bookings b
    JOIN detailers d ON d.id = b.detailer_id
    WHERE b.user_id = p_customer_profile_id
      AND d.profile_id = auth.uid()
      AND d.is_active = true
  );
END;
$$;

COMMENT ON FUNCTION is_detailer_for_customer_profile(uuid) IS 
'Checks if current user is a detailer assigned to a booking for the given customer profile. Uses SECURITY DEFINER to bypass RLS safely.';

-- Create RLS policy using the function
-- This allows detailers to view customer profiles for bookings they're assigned to
CREATE POLICY "Detailers can view customer profiles for assigned bookings"
  ON profiles FOR SELECT
  USING (is_detailer_for_customer_profile(profiles.id));

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Detailers can now view customer profile information (name, phone, email)
-- for bookings they are assigned to. The function uses SECURITY DEFINER to
-- bypass RLS safely, avoiding infinite recursion issues.
-- ============================================================================


