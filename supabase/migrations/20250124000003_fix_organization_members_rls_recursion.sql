-- ============================================================================
-- Fix: Organization Members RLS Infinite Recursion
-- ============================================================================
-- The organization_members policies were querying organization_members table 
-- within RLS, causing infinite recursion.
-- Solution: Create SECURITY DEFINER functions that bypass RLS to check membership.
-- ============================================================================

-- ============================================================================
-- Helper Functions (SECURITY DEFINER to bypass RLS)
-- ============================================================================

-- Function: Check if user is a member of an organization
CREATE OR REPLACE FUNCTION is_organization_member(
    p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM organization_members
        WHERE organization_id = p_organization_id
        AND profile_id = auth.uid()
        AND is_active = true
    );
END;
$$;

COMMENT ON FUNCTION is_organization_member(uuid) IS 
'Checks if current user is an active member of an organization. Uses SECURITY DEFINER to bypass RLS.';

-- Function: Check if user has a specific role in an organization
CREATE OR REPLACE FUNCTION has_organization_role(
    p_organization_id uuid,
    p_roles organization_role_enum[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM organization_members
        WHERE organization_id = p_organization_id
        AND profile_id = auth.uid()
        AND role = ANY(p_roles)
        AND is_active = true
    );
END;
$$;

COMMENT ON FUNCTION has_organization_role(uuid, organization_role_enum[]) IS 
'Checks if current user has one of the specified roles in an organization. Uses SECURITY DEFINER to bypass RLS.';

-- Function: Check if user is a member of the same organization as another member
CREATE OR REPLACE FUNCTION is_same_organization_member(
    p_other_profile_id uuid,
    p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM organization_members om1
        JOIN organization_members om2 ON om2.organization_id = om1.organization_id
        WHERE om1.profile_id = auth.uid()
        AND om1.organization_id = p_organization_id
        AND om1.is_active = true
        AND om2.profile_id = p_other_profile_id
        AND om2.is_active = true
    );
END;
$$;

COMMENT ON FUNCTION is_same_organization_member(uuid, uuid) IS 
'Checks if current user and another profile are members of the same organization. Uses SECURITY DEFINER to bypass RLS.';

-- ============================================================================
-- Fix ORGANIZATION_MEMBERS RLS Policies
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Members can view other members in their organization" ON organization_members;
DROP POLICY IF EXISTS "Owners and managers can update member roles" ON organization_members;
DROP POLICY IF EXISTS "Owners can remove members" ON organization_members;

-- Recreate SELECT policy using helper function (no recursion)
CREATE POLICY "Members can view other members in their organization"
    ON organization_members FOR SELECT
    USING (
        is_organization_member(organization_id)
    );

-- Recreate UPDATE policy using helper function (no recursion)
CREATE POLICY "Owners and managers can update member roles"
    ON organization_members FOR UPDATE
    USING (
        has_organization_role(organization_id, ARRAY['owner', 'manager']::organization_role_enum[])
    );

-- Recreate DELETE policy using helper function (no recursion)
CREATE POLICY "Owners can remove members"
    ON organization_members FOR DELETE
    USING (
        has_organization_role(organization_id, ARRAY['owner']::organization_role_enum[])
    );

-- ============================================================================
-- Fix ORGANIZATIONS RLS Policies
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Organization members can view their organization" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON organizations;

-- Recreate SELECT policy using helper function (no recursion)
CREATE POLICY "Organization members can view their organization"
    ON organizations FOR SELECT
    USING (
        is_organization_member(id)
    );

-- Recreate UPDATE policy using helper function (no recursion)
CREATE POLICY "Organization owners can update their organization"
    ON organizations FOR UPDATE
    USING (
        has_organization_role(id, ARRAY['owner']::organization_role_enum[])
    );

-- ============================================================================
-- Fix TEAMS RLS Policies
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Organization members can view teams" ON teams;
DROP POLICY IF EXISTS "Managers and owners can create teams" ON teams;
DROP POLICY IF EXISTS "Managers and owners can update teams" ON teams;
DROP POLICY IF EXISTS "Managers and owners can delete teams" ON teams;

-- Recreate policies using helper functions (no recursion)
CREATE POLICY "Organization members can view teams"
    ON teams FOR SELECT
    USING (
        is_organization_member(organization_id)
    );

CREATE POLICY "Managers and owners can create teams"
    ON teams FOR INSERT
    WITH CHECK (
        has_organization_role(organization_id, ARRAY['owner', 'manager']::organization_role_enum[])
    );

CREATE POLICY "Managers and owners can update teams"
    ON teams FOR UPDATE
    USING (
        has_organization_role(organization_id, ARRAY['owner', 'manager']::organization_role_enum[])
    );

CREATE POLICY "Managers and owners can delete teams"
    ON teams FOR DELETE
    USING (
        has_organization_role(organization_id, ARRAY['owner', 'manager']::organization_role_enum[])
    );

-- ============================================================================
-- Fix TEAM_MEMBERS RLS Policies
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Organization members can view team members" ON team_members;
DROP POLICY IF EXISTS "Managers and dispatchers can manage team members" ON team_members;

-- Recreate policies using helper functions (no recursion)
-- Note: We need to check organization_id from the teams table
CREATE POLICY "Organization members can view team members"
    ON team_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND is_organization_member(t.organization_id)
        )
    );

CREATE POLICY "Managers and dispatchers can manage team members"
    ON team_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND has_organization_role(t.organization_id, ARRAY['owner', 'manager', 'dispatcher']::organization_role_enum[])
        )
    );

-- ============================================================================
-- Fix PAYOUT_BATCHES RLS Policies
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Organization members can view payout batches" ON payout_batches;
DROP POLICY IF EXISTS "Owners and managers can create payout batches" ON payout_batches;
DROP POLICY IF EXISTS "Owners and managers can update payout batches" ON payout_batches;

-- Recreate policies using helper functions (no recursion)
CREATE POLICY "Organization members can view payout batches"
    ON payout_batches FOR SELECT
    USING (
        is_organization_member(organization_id)
    );

CREATE POLICY "Owners and managers can create payout batches"
    ON payout_batches FOR INSERT
    WITH CHECK (
        has_organization_role(organization_id, ARRAY['owner', 'manager']::organization_role_enum[])
    );

CREATE POLICY "Owners and managers can update payout batches"
    ON payout_batches FOR UPDATE
    USING (
        has_organization_role(organization_id, ARRAY['owner', 'manager']::organization_role_enum[])
    );

-- ============================================================================
-- Fix PAYOUT_BATCH_ITEMS RLS Policies
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Organization members can view payout batch items" ON payout_batch_items;
DROP POLICY IF EXISTS "Owners and managers can create payout batch items" ON payout_batch_items;

-- Recreate policies using helper functions (no recursion)
CREATE POLICY "Organization members can view payout batch items"
    ON payout_batch_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM payout_batches pb
            WHERE pb.id = payout_batch_items.payout_batch_id
            AND is_organization_member(pb.organization_id)
        )
    );

CREATE POLICY "Owners and managers can create payout batch items"
    ON payout_batch_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM payout_batches pb
            WHERE pb.id = payout_batch_items.payout_batch_id
            AND has_organization_role(pb.organization_id, ARRAY['owner', 'manager']::organization_role_enum[])
        )
    );

-- ============================================================================
-- Fix BOOKINGS RLS Policies (Organization Mode)
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Managers can view all organization bookings" ON bookings;
DROP POLICY IF EXISTS "Dispatchers can update organization bookings" ON bookings;

-- Recreate policies using helper functions (no recursion)
CREATE POLICY "Managers can view all organization bookings"
    ON bookings FOR SELECT
    USING (
        organization_id IS NOT NULL
        AND has_organization_role(organization_id, ARRAY['owner', 'manager', 'dispatcher']::organization_role_enum[])
    );

CREATE POLICY "Dispatchers can update organization bookings"
    ON bookings FOR UPDATE
    USING (
        organization_id IS NOT NULL
        AND has_organization_role(organization_id, ARRAY['owner', 'manager', 'dispatcher']::organization_role_enum[])
    );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Fixed infinite recursion in organization_members RLS policies by using 
-- SECURITY DEFINER functions that bypass RLS safely.
-- All organization-related policies now use helper functions instead of 
-- directly querying organization_members.
-- ============================================================================

