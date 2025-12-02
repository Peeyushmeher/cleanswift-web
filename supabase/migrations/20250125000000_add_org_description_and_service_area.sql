-- ============================================================================
-- Add description and service_area columns to organizations table
-- ============================================================================

-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'description'
    ) THEN
        ALTER TABLE organizations
            ADD COLUMN description text;
        
        COMMENT ON COLUMN organizations.description IS 'Organization description';
    END IF;
END
$$;

-- Add service_area column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'service_area'
    ) THEN
        ALTER TABLE organizations
            ADD COLUMN service_area jsonb;
        
        COMMENT ON COLUMN organizations.service_area IS 'Service zones for the organization (JSONB array)';
    END IF;
END
$$;

-- Add business_hours column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'business_hours'
    ) THEN
        ALTER TABLE organizations
            ADD COLUMN business_hours jsonb;
        
        COMMENT ON COLUMN organizations.business_hours IS 'Default business hours for the organization (JSONB)';
    END IF;
END
$$;

