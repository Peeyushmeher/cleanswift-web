-- ============================================================================
-- Create User Addresses Table Migration
-- ============================================================================
-- This migration creates a table to store user saved addresses.
-- Users can save multiple addresses and manage them in settings.
-- The first address from onboarding will be saved as "Home" with is_default=true.
-- ============================================================================

-- ============================================================================
-- STEP 1: Create user_addresses table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    province text NOT NULL,
    postal_code text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_default ON user_addresses(user_id, is_default);

-- ============================================================================
-- STEP 3: Add updated_at trigger
-- ============================================================================

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 4: Add RLS policies
-- ============================================================================

ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own addresses
CREATE POLICY "Users can view their own addresses"
    ON user_addresses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own addresses
CREATE POLICY "Users can insert their own addresses"
    ON user_addresses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own addresses
CREATE POLICY "Users can update their own addresses"
    ON user_addresses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own addresses
CREATE POLICY "Users can delete their own addresses"
    ON user_addresses
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 5: Add constraint to ensure only one default address per user
-- ============================================================================

-- Function to ensure only one default address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this address as default, unset all other defaults for this user
    IF NEW.is_default = true THEN
        UPDATE user_addresses
        SET is_default = false, updated_at = now()
        WHERE user_id = NEW.user_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default address
CREATE TRIGGER ensure_single_default_address_trigger
    BEFORE INSERT OR UPDATE ON user_addresses
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_address();

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE user_addresses IS 'Stored addresses for users. Users can save multiple addresses and manage them in settings.';
COMMENT ON COLUMN user_addresses.name IS 'User-friendly name for the address (e.g., "Home", "Work", "Office")';
COMMENT ON COLUMN user_addresses.is_default IS 'Indicates if this is the default address for the user. Only one address per user can be default.';
COMMENT ON COLUMN user_addresses.latitude IS 'GPS latitude coordinate (from geocoding)';
COMMENT ON COLUMN user_addresses.longitude IS 'GPS longitude coordinate (from geocoding)';

-- ============================================================================
-- Migration Complete
-- ============================================================================

