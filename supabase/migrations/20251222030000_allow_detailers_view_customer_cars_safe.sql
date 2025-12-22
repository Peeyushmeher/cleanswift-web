-- ============================================================================
-- Allow Detailers to View Customer Cars for Assigned Bookings (Safe)
-- ============================================================================
-- This migration adds an RLS policy to allow detailers to view car
-- information for bookings they're assigned to. It uses a SECURITY
-- DEFINER function to avoid infinite recursion issues.
--
-- The solution:
-- 1. Creates a SECURITY DEFINER function that checks if the current user
--    is a detailer assigned to a booking that uses the car being viewed
-- 2. Creates an RLS policy that uses this function
-- 3. Avoids recursion by using SECURITY DEFINER (bypasses RLS) in the function
-- ============================================================================

-- Create a function to check if current user is a detailer assigned to
-- a booking that uses the given car
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION is_detailer_for_customer_car(p_car_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's a booking where:
  -- 1. The car (car_id) matches the car being viewed
  -- 2. The booking is assigned to a detailer
  -- 3. That detailer is linked to the current user's profile
  -- 4. The detailer is active
  RETURN EXISTS (
    SELECT 1
    FROM bookings b
    JOIN detailers d ON d.id = b.detailer_id
    WHERE b.car_id = p_car_id
      AND d.profile_id = auth.uid()
      AND d.is_active = true
  );
END;
$$;

COMMENT ON FUNCTION is_detailer_for_customer_car(uuid) IS 
'Checks if current user is a detailer assigned to a booking that uses the given car. Uses SECURITY DEFINER to bypass RLS safely.';

-- Create RLS policy using the function
-- This allows detailers to view car information for bookings they're assigned to
CREATE POLICY "Detailers can view customer cars for assigned bookings"
  ON cars FOR SELECT
  USING (is_detailer_for_customer_car(cars.id));

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Detailers can now view car information (make, model, year, license_plate)
-- for bookings they are assigned to. The function uses SECURITY DEFINER to
-- bypass RLS safely, avoiding infinite recursion issues.
-- ============================================================================

