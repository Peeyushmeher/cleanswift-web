-- ============================================================================
-- Allow Detailers to Update Their Own Profile
-- ============================================================================
-- This migration adds an RLS policy that allows detailers to update their own
-- detailer record. This is necessary for the update_detailer_profile RPC function
-- to work when detailers try to update their profile information (e.g., avatar_url).
--
-- Problem:
-- The existing RLS policies only allow:
-- - Admins to update all detailers
-- - Anyone to view active detailers
-- There is no policy allowing detailers to update their own records.
--
-- Even though update_detailer_profile uses SECURITY DEFINER, RLS policies still
-- apply to the UPDATE operation, blocking detailers from updating their own profile.
--
-- Solution:
-- Add a policy "Detailers can update their own profile" that checks:
-- 1. The user's role is 'detailer'
-- 2. The detailer record's profile_id matches auth.uid()
-- 3. They cannot change is_active (that's admin only, enforced by the RPC function)
-- ============================================================================

-- Add policy for detailers to update their own profile
CREATE POLICY "Detailers can update their own profile"
  ON detailers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'detailer'
        AND detailers.profile_id = p.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'detailer'
        AND detailers.profile_id = p.id
    )
  );

COMMENT ON POLICY "Detailers can update their own profile" ON detailers IS 
'Allows detailers to update their own detailer record. Checks that the user is a detailer and the detailer record belongs to them (profile_id = auth.uid()). Note: is_active can only be changed by admins (enforced by update_detailer_profile RPC function).';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Detailers can now update their own profile, enabling:
-- 1. Updating avatar_url via update_detailer_profile RPC
-- 2. Updating full_name, years_experience, bio, specialties, etc.
-- 3. Updating service_radius_km, latitude, longitude
--
-- Restrictions:
-- - Detailers can only update their own record (profile_id must match auth.uid())
-- - is_active can only be changed by admins (enforced by RPC function)
-- ============================================================================

