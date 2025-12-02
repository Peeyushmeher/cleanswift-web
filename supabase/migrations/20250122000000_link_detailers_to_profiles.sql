-- ============================================================================
-- Link Detailers to Profiles
-- ============================================================================
-- This migration adds a profile_id column to the detailers table to link
-- detailer records to user profiles. This enables proper authentication
-- and RLS policy enforcement for detailers.
--
-- Changes:
-- 1. Add profile_id column to detailers table
-- 2. Add unique constraint on profile_id
-- 3. Add foreign key constraint to profiles
-- 4. Note: Existing detailers will need to be manually linked to profiles
--    (this will be handled by detailer management functions)
-- ============================================================================

-- Add profile_id column to detailers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detailers' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE detailers
      ADD COLUMN profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
    
    COMMENT ON COLUMN detailers.profile_id IS 'Reference to the user profile for this detailer. Links detailer record to auth user.';
  END IF;
END
$$;

-- Add unique constraint on profile_id (one detailer per profile)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'detailers_profile_id_key'
  ) THEN
    ALTER TABLE detailers
      ADD CONSTRAINT detailers_profile_id_key UNIQUE (profile_id);
  END IF;
END
$$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_detailers_profile_id ON detailers(profile_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The detailers table now has a profile_id column that links to profiles.
-- 
-- Next steps:
-- 1. Update accept_booking function to find detailer by profile_id
-- 2. Update RLS policies to use detailers.profile_id = auth.uid()
-- 3. Create detailer management functions to link profiles to detailers
-- ============================================================================

