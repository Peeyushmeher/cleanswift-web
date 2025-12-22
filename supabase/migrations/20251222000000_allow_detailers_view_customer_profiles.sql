-- ============================================================================
-- Allow Detailers to View Customer Profiles for Assigned Bookings
-- ============================================================================
-- This migration adds an RLS policy to the profiles table that allows
-- detailers to view customer profile information for bookings they are
-- assigned to. This fixes the issue where customer information shows as
-- "N/A" on booking detail pages for detailers.
--
-- The policy ensures that:
-- 1. The detailer is assigned to a booking (bookings.detailer_id = detailers.id)
-- 2. The booking's user_id matches the profile being viewed
-- 3. The detailer's profile is linked and active
-- ============================================================================

-- Add policy for detailers to view customer profiles for their assigned bookings
-- This policy allows detailers to view customer profile information (name, phone, email)
-- for bookings they are assigned to, which is necessary for the booking detail pages
-- NOTE: This policy was fixed in migration 20251222000001 to remove infinite recursion
-- by removing the profiles join. The fixed version only checks detailer records.
CREATE POLICY "Detailers can view customer profiles for assigned bookings"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      JOIN detailers d ON d.id = b.detailer_id
      WHERE b.user_id = profiles.id
        AND d.profile_id = auth.uid()
        AND d.is_active = true
    )
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Detailers can now view customer profile information (name, phone, email)
-- for bookings they are assigned to. This allows the booking detail pages
-- to display customer information correctly.
-- ============================================================================

