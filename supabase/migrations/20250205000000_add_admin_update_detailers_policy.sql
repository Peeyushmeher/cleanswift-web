-- ============================================================================
-- Add Admin Policy to Update Detailers
-- ============================================================================
-- This migration adds an RLS policy that allows admins to update detailers,
-- including changing their is_active status. This is necessary for the admin
-- dashboard to approve pending detailer applications.
--
-- Problem:
-- The existing policy "Admins can view all detailers" only allows SELECT
-- operations. When admins try to update detailers (e.g., approve applications
-- by setting is_active = true), RLS blocks the UPDATE operation.
--
-- Solution:
-- Add a new policy "Admins can update all detailers" that uses the is_admin()
-- function to check if the current user is an admin, allowing them to update
-- any detailer record, including changing is_active status.
-- ============================================================================

-- Add admin policy to update all detailers
CREATE POLICY "Admins can update all detailers"
  ON detailers FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

COMMENT ON POLICY "Admins can update all detailers" ON detailers IS 
'Allows admins to update any detailer, including changing is_active status. Uses is_admin() function to check admin role.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Admins can now update detailers, enabling:
-- 1. Approving pending detailer applications (setting is_active = true)
-- 2. Suspending active detailers (setting is_active = false)
-- 3. Updating detailer information (bio, service_radius_km, etc.)
-- ============================================================================

