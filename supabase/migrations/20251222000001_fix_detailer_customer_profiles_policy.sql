-- ============================================================================
-- Fix: Detailer Customer Profiles Policy - Remove Infinite Recursion
-- ============================================================================
-- The previous migration caused infinite recursion by joining profiles table
-- within a profiles RLS policy. This fix removes the profiles join and only
-- checks the detailer record, which is sufficient for security.
-- ============================================================================

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Detailers can view customer profiles for assigned bookings" ON profiles;

-- Recreate the policy without the profiles join to avoid recursion
-- We only need to check:
-- 1. There's a booking where the customer (user_id) matches the profile being viewed
-- 2. The booking is assigned to a detailer (detailer_id)
-- 3. That detailer record is linked to the current user (profile_id = auth.uid())
-- 4. The detailer is active
-- We don't need to check the role in profiles because having an active detailer
-- record linked to the user is sufficient proof they are a detailer.
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
-- Fixed infinite recursion by removing the profiles join from the policy.
-- The policy now only checks detailer records, which is sufficient for
-- security and avoids recursion issues.
-- ============================================================================

