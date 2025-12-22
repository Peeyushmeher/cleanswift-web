-- ============================================================================
-- Rollback: Remove Detailer Customer Profiles Policy
-- ============================================================================
-- This migration rolls back the changes made in:
-- - 20251222003756 - allow_detailers_view_customer_profiles
-- - 20251222004001 - fix_detailer_customer_profiles_policy
--
-- This will remove the RLS policy that allows detailers to view customer
-- profile information for bookings they're assigned to. After this rollback,
-- customer information will display as "N/A" on booking detail pages for
-- detailers, returning to the original behavior.
-- ============================================================================

-- Drop the policy that allows detailers to view customer profiles
DROP POLICY IF EXISTS "Detailers can view customer profiles for assigned bookings" ON profiles;

-- ============================================================================
-- Rollback Complete
-- ============================================================================
-- The policy has been removed. Detailers will no longer be able to view
-- customer profile information (name, phone, email) for bookings they're
-- assigned to. Customer information will display as "N/A" on booking detail
-- pages for detailers.
-- ============================================================================

