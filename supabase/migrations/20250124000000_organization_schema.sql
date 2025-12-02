-- ============================================================================
-- Phase 2: Organization Foundation - Database Schema
-- ============================================================================
-- This migration creates the database schema for organization support:
-- 1. organizations - Organization info, Stripe Connect account ID
-- 2. organization_members - Link profiles to organizations with roles
-- 3. teams - Teams within organizations
-- 4. team_members - Link detailers to teams
-- 5. payout_batches - Organization payout tracking (for Stripe Connect)
-- 6. payout_batch_items - Individual detailer payouts in a batch
-- 7. Updates to detailers and bookings tables
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    business_logo_url text,
    stripe_connect_account_id text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at DESC);

COMMENT ON TABLE organizations IS 'Organizations that manage multiple detailers';
COMMENT ON COLUMN organizations.name IS 'Organization name';
COMMENT ON COLUMN organizations.business_logo_url IS 'URL to organization logo';
COMMENT ON COLUMN organizations.stripe_connect_account_id IS 'Stripe Connect account ID for payouts';
COMMENT ON COLUMN organizations.is_active IS 'Whether the organization is active';

-- Add updated_at trigger
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. ORGANIZATION_MEMBERS TABLE
-- ============================================================================
-- Role enum for organization members
DO $$
BEGIN
    CREATE TYPE organization_role_enum AS ENUM ('owner', 'manager', 'dispatcher', 'detailer');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON TYPE organization_role_enum IS 'Roles within an organization: owner, manager, dispatcher, detailer';

CREATE TABLE IF NOT EXISTS organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role organization_role_enum NOT NULL DEFAULT 'detailer',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_profile_id ON organization_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_organization_members_is_active ON organization_members(is_active);

COMMENT ON TABLE organization_members IS 'Links profiles to organizations with roles';
COMMENT ON COLUMN organization_members.role IS 'Role within the organization';
COMMENT ON COLUMN organization_members.is_active IS 'Whether the member is active';

-- Add updated_at trigger
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. TEAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    service_area jsonb, -- GeoJSON polygon or other service area definition
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

COMMENT ON TABLE teams IS 'Teams within organizations';
COMMENT ON COLUMN teams.name IS 'Team name';
COMMENT ON COLUMN teams.service_area IS 'Service area definition (JSONB)';
COMMENT ON COLUMN teams.is_active IS 'Whether the team is active';

-- Add updated_at trigger
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. TEAM_MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(team_id, detailer_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_detailer_id ON team_members(detailer_id);

COMMENT ON TABLE team_members IS 'Links detailers to teams';
COMMENT ON COLUMN team_members.team_id IS 'Reference to the team';
COMMENT ON COLUMN team_members.detailer_id IS 'Reference to the detailer';

-- ============================================================================
-- 5. PAYOUT_BATCHES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    batch_date date NOT NULL,
    total_jobs integer NOT NULL DEFAULT 0,
    total_amount numeric(10,2) NOT NULL DEFAULT 0,
    stripe_payout_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_org_id ON payout_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_payout_batches_batch_date ON payout_batches(batch_date DESC);
CREATE INDEX IF NOT EXISTS idx_payout_batches_stripe_payout_id ON payout_batches(stripe_payout_id);

COMMENT ON TABLE payout_batches IS 'Organization payout batches (for Stripe Connect)';
COMMENT ON COLUMN payout_batches.batch_date IS 'Date of the payout batch';
COMMENT ON COLUMN payout_batches.total_jobs IS 'Total number of jobs in the batch';
COMMENT ON COLUMN payout_batches.total_amount IS 'Total payout amount';
COMMENT ON COLUMN payout_batches.stripe_payout_id IS 'Stripe payout ID (when processed)';

-- Add updated_at trigger
CREATE TRIGGER update_payout_batches_updated_at BEFORE UPDATE ON payout_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. PAYOUT_BATCH_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payout_batch_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_batch_id uuid NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,
    detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    stripe_transfer_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch_id ON payout_batch_items(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_detailer_id ON payout_batch_items(detailer_id);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_stripe_transfer_id ON payout_batch_items(stripe_transfer_id);

COMMENT ON TABLE payout_batch_items IS 'Individual detailer payouts within a batch';
COMMENT ON COLUMN payout_batch_items.amount IS 'Payout amount for this detailer';
COMMENT ON COLUMN payout_batch_items.stripe_transfer_id IS 'Stripe transfer ID (when processed)';

-- ============================================================================
-- 7. UPDATE DETAILERS TABLE
-- ============================================================================
-- Add organization_id to detailers table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'detailers' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE detailers
            ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_detailers_organization_id ON detailers(organization_id);
        
        COMMENT ON COLUMN detailers.organization_id IS 'Reference to organization (null for solo detailers)';
    END IF;
END
$$;

-- ============================================================================
-- 8. UPDATE BOOKINGS TABLE
-- ============================================================================
-- Add organization_id and team_id to bookings table
DO $$
BEGIN
    -- Add organization_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE bookings
            ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_bookings_organization_id ON bookings(organization_id);
        
        COMMENT ON COLUMN bookings.organization_id IS 'Reference to organization (for org analytics)';
    END IF;

    -- Add team_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE bookings
            ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_bookings_team_id ON bookings(team_id);
        
        COMMENT ON COLUMN bookings.team_id IS 'Reference to team (optional)';
    END IF;
END
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Organization schema is now in place. Next steps:
-- 1. Create RLS policies (see next migration)
-- 2. Create organization management functions
-- 3. Implement mode detection logic
-- ============================================================================

