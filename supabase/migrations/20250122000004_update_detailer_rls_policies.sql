-- ============================================================================
-- Update Detailer RLS Policies
-- ============================================================================
-- This migration updates RLS policies for bookings to work with the new
-- detailer-profile link. Instead of checking bookings.detailer_id = profile.id,
-- it now checks if the booking's detailer_id matches the detailer record
-- linked to the current user's profile.
--
-- Changes:
-- 1. Update "Detailers can view assigned bookings" policy
-- 2. Update "Detailers can update assigned bookings" policy
-- 3. Ensure policies use detailers.profile_id = auth.uid() pattern
-- ============================================================================

-- Drop existing detailer policies
DROP POLICY IF EXISTS "Detailers can view assigned bookings" ON bookings;
DROP POLICY IF EXISTS "Detailers can update assigned bookings" ON bookings;

-- Recreate "Detailers can view assigned bookings" policy
-- This checks if the booking's detailer_id matches a detailer record
-- that is linked to the current user's profile
CREATE POLICY "Detailers can view assigned bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = bookings.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
        AND d.is_active = true
    )
  );

-- Recreate "Detailers can update assigned bookings" policy
CREATE POLICY "Detailers can update assigned bookings"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = bookings.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
        AND d.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = bookings.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
        AND d.is_active = true
    )
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- RLS policies now correctly check:
-- 1. Booking's detailer_id matches a detailer record
-- 2. That detailer record is linked to the current user's profile (profile_id = auth.uid())
-- 3. The user's role is 'detailer'
-- 4. The detailer is active
-- ============================================================================

