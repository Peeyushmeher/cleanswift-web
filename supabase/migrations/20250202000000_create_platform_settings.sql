-- ============================================================================
-- Platform Settings Migration - Add get_platform_fee_percentage function
-- ============================================================================
-- This migration adds:
-- 1. get_platform_fee_percentage() function - Get platform fee percentage
--
-- Note: The platform_settings table and other functions already exist
-- from the admin_settings_schema migration. This migration only adds
-- the missing get_platform_fee_percentage function.
-- The existing table uses 'key' and 'value' columns (not 'setting_key'/'setting_value').
-- ============================================================================

-- ============================================================================
-- FUNCTION: get_platform_fee_percentage
-- ============================================================================
-- Returns the platform fee percentage as a numeric value
-- Can be called by any authenticated user (for calculations)
-- Uses the existing platform_settings table structure (key/value columns)

CREATE OR REPLACE FUNCTION public.get_platform_fee_percentage()
RETURNS numeric(5,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fee_percentage numeric(5,2);
BEGIN
  -- Get platform fee percentage from settings
  -- The value is stored as jsonb, so we need to extract it properly
  SELECT 
    CASE 
      WHEN jsonb_typeof(value) = 'number' THEN (value::text)::numeric(5,2)
      WHEN jsonb_typeof(value) = 'string' THEN (value::text)::numeric(5,2)
      ELSE 15.00
    END
  INTO fee_percentage
  FROM platform_settings
  WHERE key = 'platform_fee_percentage';

  -- Return default of 15% if not found
  RETURN COALESCE(fee_percentage, 15.00);
END;
$$;

COMMENT ON FUNCTION public.get_platform_fee_percentage IS 
'Returns the platform fee percentage. Can be called by any authenticated user. Defaults to 15% if not set.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_platform_fee_percentage TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- This migration adds the get_platform_fee_percentage() function.
-- The platform_settings table and other functions already exist from
-- the admin_settings_schema migration.
-- ============================================================================
