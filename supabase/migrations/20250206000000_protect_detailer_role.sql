-- ============================================================================
-- Protect Detailer Role from Being Changed to 'user'
-- ============================================================================
-- This migration:
-- 1. Updates update_user_role function to prevent changing detailer role to 'user'
-- 2. Adds a database trigger as a safety net to ensure detailers always have role='detailer'
-- ============================================================================

-- ============================================================================
-- 1. Update update_user_role function to protect detailer roles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id uuid,
  p_new_role user_role_enum
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  updated_profile profiles;
  has_detailer_record boolean;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Verify admin role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- 3) Validate user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- 4) Prevent changing admin role (safety check)
  IF p_user_id = current_user_id AND p_new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot remove admin role from yourself';
  END IF;

  -- 5) Check if user has a detailer record
  SELECT EXISTS (
    SELECT 1 FROM detailers 
    WHERE profile_id = p_user_id
  ) INTO has_detailer_record;

  -- 6) Protect detailer role: If user has detailer record, prevent changing to 'user'
  IF has_detailer_record AND p_new_role = 'user' THEN
    RAISE EXCEPTION 'Cannot change role to ''user'' for a profile with a detailer record. Detailers must have role=''detailer''. If you need to deactivate the detailer, set is_active=false on the detailer record instead.';
  END IF;

  -- 7) If user has detailer record but role is wrong, automatically set to 'detailer'
  IF has_detailer_record AND p_new_role != 'detailer' THEN
    -- Force role to 'detailer' if they have a detailer record
    UPDATE profiles
    SET
      role = 'detailer',
      updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO updated_profile;
    
    RAISE WARNING 'User has detailer record. Role automatically set to ''detailer'' instead of ''%''', p_new_role;
  ELSE
    -- 8) Update role normally if no detailer record or setting to 'detailer'
    UPDATE profiles
    SET
      role = p_new_role,
      updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO updated_profile;
  END IF;

  -- 9) Return updated profile
  RETURN updated_profile;
END;
$$;

COMMENT ON FUNCTION public.update_user_role IS 
'Allows admin to update a user''s role. Admin only. Prevents admins from removing their own admin role. Protects detailer roles: users with detailer records cannot have role changed to ''user''. If a user has a detailer record, their role will be automatically set to ''detailer''.';

-- ============================================================================
-- 2. Create trigger function to protect detailer roles
-- ============================================================================
-- This trigger acts as a safety net to ensure detailers always have role='detailer'
-- It will automatically correct the role if someone tries to set it to 'user'

CREATE OR REPLACE FUNCTION public.protect_detailer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_detailer_record boolean;
BEGIN
  -- Check if this profile has a detailer record
  SELECT EXISTS (
    SELECT 1 FROM detailers 
    WHERE profile_id = NEW.id
  ) INTO has_detailer_record;

  -- If profile has detailer record, ensure role is 'detailer'
  IF has_detailer_record THEN
    IF NEW.role != 'detailer' THEN
      -- Log a warning and automatically set role to 'detailer'
      RAISE WARNING 'Profile % has detailer record but role was set to %. Automatically correcting to detailer.', NEW.id, NEW.role;
      NEW.role := 'detailer';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_detailer_role IS 
'Safety net trigger function that ensures profiles with detailer records always have role=''detailer''. Automatically corrects role if it is set to anything else.';

-- ============================================================================
-- 3. Create trigger on profiles table
-- ============================================================================

DROP TRIGGER IF EXISTS protect_detailer_role_trigger ON profiles;

CREATE TRIGGER protect_detailer_role_trigger
  BEFORE UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.protect_detailer_role();

COMMENT ON TRIGGER protect_detailer_role_trigger ON profiles IS 
'Protects detailer roles from being changed. If a profile has a detailer record, the role will be automatically set to ''detailer'' even if someone tries to change it.';

-- ============================================================================
-- 4. Fix any existing profiles that have detailer records but wrong role
-- ============================================================================

UPDATE profiles
SET role = 'detailer', updated_at = now()
WHERE role != 'detailer'
  AND EXISTS (
    SELECT 1 FROM detailers 
    WHERE detailers.profile_id = profiles.id
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Detailer role protection is now in place:
-- 1. update_user_role function prevents changing detailer role to 'user'
-- 2. Database trigger automatically corrects role if changed incorrectly
-- 3. Any existing incorrect roles have been fixed
-- ============================================================================

