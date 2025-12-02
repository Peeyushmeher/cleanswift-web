-- ============================================================================
-- Phase 2: Organization Foundation - RLS Policies
-- ============================================================================
-- This migration creates Row Level Security policies for organization tables
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATIONS TABLE POLICIES
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can view their organization
CREATE POLICY "Organization members can view their organization"
    ON organizations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.is_active = true
        )
    );

-- Owners can update their organization
CREATE POLICY "Organization owners can update their organization"
    ON organizations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.role = 'owner'
            AND organization_members.is_active = true
        )
    );

-- Owners can insert organizations (via function, not direct insert)
-- Direct inserts are restricted - use create_organization function instead

-- ============================================================================
-- 2. ORGANIZATION_MEMBERS TABLE POLICIES
-- ============================================================================
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members in their organization
CREATE POLICY "Members can view other members in their organization"
    ON organization_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id
            AND om2.profile_id = auth.uid()
            AND om2.is_active = true
        )
    );

-- Owners/managers can insert new members (via function)
-- Direct inserts are restricted - use invite_member function instead

-- Owners/managers can update member roles
CREATE POLICY "Owners and managers can update member roles"
    ON organization_members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id
            AND om2.profile_id = auth.uid()
            AND om2.role IN ('owner', 'manager')
            AND om2.is_active = true
        )
    );

-- Owners can remove members
CREATE POLICY "Owners can remove members"
    ON organization_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id
            AND om2.profile_id = auth.uid()
            AND om2.role = 'owner'
            AND om2.is_active = true
        )
    );

-- ============================================================================
-- 3. TEAMS TABLE POLICIES
-- ============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Organization members can view teams in their organization
CREATE POLICY "Organization members can view teams"
    ON teams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = teams.organization_id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.is_active = true
        )
    );

-- Managers/owners can create teams
CREATE POLICY "Managers and owners can create teams"
    ON teams FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = teams.organization_id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.role IN ('owner', 'manager')
            AND organization_members.is_active = true
        )
    );

-- Managers/owners can update teams
CREATE POLICY "Managers and owners can update teams"
    ON teams FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = teams.organization_id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.role IN ('owner', 'manager')
            AND organization_members.is_active = true
        )
    );

-- Managers/owners can delete teams
CREATE POLICY "Managers and owners can delete teams"
    ON teams FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = teams.organization_id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.role IN ('owner', 'manager')
            AND organization_members.is_active = true
        )
    );

-- ============================================================================
-- 4. TEAM_MEMBERS TABLE POLICIES
-- ============================================================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Organization members can view team members
CREATE POLICY "Organization members can view team members"
    ON team_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM teams t
            JOIN organization_members om ON om.organization_id = t.organization_id
            WHERE t.id = team_members.team_id
            AND om.profile_id = auth.uid()
            AND om.is_active = true
        )
    );

-- Managers/dispatchers can manage team members
CREATE POLICY "Managers and dispatchers can manage team members"
    ON team_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM teams t
            JOIN organization_members om ON om.organization_id = t.organization_id
            WHERE t.id = team_members.team_id
            AND om.profile_id = auth.uid()
            AND om.role IN ('owner', 'manager', 'dispatcher')
            AND om.is_active = true
        )
    );

-- ============================================================================
-- 5. PAYOUT_BATCHES TABLE POLICIES
-- ============================================================================
ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;

-- Organization members can view payout batches
CREATE POLICY "Organization members can view payout batches"
    ON payout_batches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = payout_batches.organization_id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.is_active = true
        )
    );

-- Owners/managers can create payout batches
CREATE POLICY "Owners and managers can create payout batches"
    ON payout_batches FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = payout_batches.organization_id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.role IN ('owner', 'manager')
            AND organization_members.is_active = true
        )
    );

-- Owners/managers can update payout batches
CREATE POLICY "Owners and managers can update payout batches"
    ON payout_batches FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = payout_batches.organization_id
            AND organization_members.profile_id = auth.uid()
            AND organization_members.role IN ('owner', 'manager')
            AND organization_members.is_active = true
        )
    );

-- ============================================================================
-- 6. PAYOUT_BATCH_ITEMS TABLE POLICIES
-- ============================================================================
ALTER TABLE payout_batch_items ENABLE ROW LEVEL SECURITY;

-- Organization members can view payout batch items
CREATE POLICY "Organization members can view payout batch items"
    ON payout_batch_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM payout_batches pb
            JOIN organization_members om ON om.organization_id = pb.organization_id
            WHERE pb.id = payout_batch_items.payout_batch_id
            AND om.profile_id = auth.uid()
            AND om.is_active = true
        )
    );

-- Detailers can view their own payout items
CREATE POLICY "Detailers can view their own payout items"
    ON payout_batch_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM detailers
            WHERE detailers.id = payout_batch_items.detailer_id
            AND detailers.profile_id = auth.uid()
        )
    );

-- Owners/managers can create payout batch items
CREATE POLICY "Owners and managers can create payout batch items"
    ON payout_batch_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM payout_batches pb
            JOIN organization_members om ON om.organization_id = pb.organization_id
            WHERE pb.id = payout_batch_items.payout_batch_id
            AND om.profile_id = auth.uid()
            AND om.role IN ('owner', 'manager')
            AND om.is_active = true
        )
    );

-- ============================================================================
-- 7. UPDATE BOOKINGS RLS POLICIES FOR ORGANIZATION MODE
-- ============================================================================
-- Note: Existing bookings policies should allow:
-- - Detailers see their own bookings (solo mode)
-- - Managers see all org bookings (org mode)

-- Add policy for managers to view all organization bookings
CREATE POLICY "Managers can view all organization bookings"
    ON bookings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = bookings.organization_id
            AND om.profile_id = auth.uid()
            AND om.role IN ('owner', 'manager', 'dispatcher')
            AND om.is_active = true
        )
    );

-- Add policy for dispatchers to view and update organization bookings
CREATE POLICY "Dispatchers can update organization bookings"
    ON bookings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = bookings.organization_id
            AND om.profile_id = auth.uid()
            AND om.role IN ('owner', 'manager', 'dispatcher')
            AND om.is_active = true
        )
    );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- RLS policies for organizations are now in place.
-- Next: Create organization management functions
-- ============================================================================

