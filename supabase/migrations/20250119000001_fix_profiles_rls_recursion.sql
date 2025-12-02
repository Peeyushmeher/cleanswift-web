-- ============================================================================
-- Fix: Profiles RLS Infinite Recursion
-- ============================================================================
-- The admin policies were querying profiles table within RLS, causing infinite recursion.
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to check admin role.
-- ============================================================================

-- Create a function to check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION is_admin() IS 'Checks if current user has admin role. Uses SECURITY DEFINER to bypass RLS.';

-- Drop the problematic admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Recreate admin policies using the function (no recursion)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Also fix admin policies for other tables that have the same issue
DROP POLICY IF EXISTS "Admins can access all cars" ON cars;
CREATE POLICY "Admins can access all cars"
  ON cars FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all bookings" ON bookings;
CREATE POLICY "Admins can manage all bookings"
  ON bookings FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all booking_services" ON booking_services;
CREATE POLICY "Admins can manage all booking_services"
  ON booking_services FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
CREATE POLICY "Admins can manage all payments"
  ON payments FOR ALL
  USING (is_admin());

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Fixed infinite recursion in profiles RLS policies by using SECURITY DEFINER function.
-- All admin policies now use is_admin() function which bypasses RLS safely.
-- ============================================================================

