-- ============================================================================
-- Add Admin RLS Policies for Services and Service Add-ons
-- ============================================================================
-- This migration adds RLS policies to allow admins to manage services and
-- service_addons tables. Currently, only SELECT policies exist for viewing
-- active items. This adds policies for admins to view all (including inactive)
-- and manage (INSERT/UPDATE/DELETE) all services and add-ons.
-- ============================================================================

-- ============================================================================
-- SERVICES TABLE - Admin Policies
-- ============================================================================

-- Admins can view all services (including inactive ones)
CREATE POLICY "Admins can view all services"
  ON services FOR SELECT
  USING (is_admin());

-- Admins can manage all services (INSERT/UPDATE/DELETE)
CREATE POLICY "Admins can manage all services"
  ON services FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- SERVICE_ADDONS TABLE - Admin Policies
-- ============================================================================

-- Admins can view all service add-ons (including inactive ones)
CREATE POLICY "Admins can view all service add-ons"
  ON service_addons FOR SELECT
  USING (is_admin());

-- Admins can manage all service add-ons (INSERT/UPDATE/DELETE)
CREATE POLICY "Admins can manage all service add-ons"
  ON service_addons FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Admins can now:
-- - View all services and service_addons (including inactive)
-- - Create, update, and delete services and service_addons
-- Uses the existing is_admin() function to avoid RLS recursion issues.
-- ============================================================================

