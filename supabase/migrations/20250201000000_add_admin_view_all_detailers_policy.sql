-- ============================================================================
-- Add Admin Policy to View All Detailers (Including Inactive)
-- ============================================================================
-- This migration adds an RLS policy that allows admins to view all detailers,
-- including inactive ones. This is necessary for the admin dashboard to display
-- pending detailer applications (detailers with is_active = false).
--
-- Problem:
-- The existing policy "Anyone can view active detailers" only allows viewing
-- detailers where is_active = true. When admins query for pending applications
-- (is_active = false), RLS blocks the query.
--
-- Solution:
-- Add a new policy "Admins can view all detailers" that uses the is_admin()
-- function to check if the current user is an admin, allowing them to view
-- all detailers regardless of is_active status.
-- ============================================================================

-- Add admin policy to view all detailers (including inactive)
CREATE POLICY "Admins can view all detailers"
  ON detailers FOR SELECT
  USING (is_admin());

COMMENT ON POLICY "Admins can view all detailers" ON detailers IS 
'Allows admins to view all detailers, including inactive ones. Uses is_admin() function to check admin role.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Admins can now query detailers with any is_active status, enabling:
-- 1. Viewing pending detailer applications on admin dashboard
-- 2. Filtering detailers by status (active/inactive) in admin panel
-- 3. Reviewing and approving detailer applications
-- ============================================================================
