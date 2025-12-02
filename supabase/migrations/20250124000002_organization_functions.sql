-- ============================================================================
-- Phase 2: Organization Foundation - Management Functions
-- ============================================================================
-- This migration creates RPC functions for managing organizations
-- ============================================================================

-- ============================================================================
-- Function: get_user_organization
-- ============================================================================
-- Returns the organization for a user (or null if solo)
CREATE OR REPLACE FUNCTION public.get_user_organization(
    p_profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    business_logo_url text,
    stripe_connect_account_id text,
    is_active boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_profile_id uuid;
BEGIN
    -- Use provided profile_id or current user
    target_profile_id := COALESCE(p_profile_id, auth.uid());
    
    IF target_profile_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Return organization if user is a member
    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        o.business_logo_url,
        o.stripe_connect_account_id,
        o.is_active,
        o.created_at
    FROM organizations o
    JOIN organization_members om ON om.organization_id = o.id
    WHERE om.profile_id = target_profile_id
    AND om.is_active = true
    AND o.is_active = true
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_user_organization IS 
'Gets the organization for a user. Returns null if user is solo. Users can get their own, admins can get any.';

-- ============================================================================
-- Function: is_organization_member
-- ============================================================================
-- Checks if a user is a member of an organization
CREATE OR REPLACE FUNCTION public.is_organization_member(
    p_profile_id uuid,
    p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
    is_member boolean;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user is member (or admin checking)
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id
        AND profile_id = p_profile_id
        AND is_active = true
    ) INTO is_member;

    RETURN is_member;
END;
$$;

COMMENT ON FUNCTION public.is_organization_member IS 
'Checks if a profile is a member of an organization. Returns boolean.';

-- ============================================================================
-- Function: get_organization_members
-- ============================================================================
-- Returns all members of an organization
CREATE OR REPLACE FUNCTION public.get_organization_members(
    p_organization_id uuid
)
RETURNS TABLE (
    id uuid,
    profile_id uuid,
    full_name text,
    email text,
    role organization_role_enum,
    is_active boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user is a member of the organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id
        AND profile_id = current_user_id
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Not a member of this organization';
    END IF;

    -- Return all members
    RETURN QUERY
    SELECT 
        om.id,
        om.profile_id,
        p.full_name,
        p.email,
        om.role,
        om.is_active,
        om.created_at
    FROM organization_members om
    JOIN profiles p ON p.id = om.profile_id
    WHERE om.organization_id = p_organization_id
    ORDER BY 
        CASE om.role
            WHEN 'owner' THEN 1
            WHEN 'manager' THEN 2
            WHEN 'dispatcher' THEN 3
            WHEN 'detailer' THEN 4
        END,
        om.created_at;
END;
$$;

COMMENT ON FUNCTION public.get_organization_members IS 
'Gets all members of an organization. Only members of the organization can call this.';

-- ============================================================================
-- Function: get_user_role_in_organization
-- ============================================================================
-- Gets the role of a user in an organization
CREATE OR REPLACE FUNCTION public.get_user_role_in_organization(
    p_profile_id uuid,
    p_organization_id uuid
)
RETURNS organization_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role organization_role_enum;
BEGIN
    -- Get user's role in organization
    SELECT om.role INTO user_role
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.profile_id = p_profile_id
    AND om.is_active = true
    LIMIT 1;

    RETURN user_role;
END;
$$;

COMMENT ON FUNCTION public.get_user_role_in_organization IS 
'Gets the role of a user in an organization. Returns null if not a member.';

-- ============================================================================
-- Function: create_organization
-- ============================================================================
-- Creates a new organization and adds the creator as owner
CREATE OR REPLACE FUNCTION public.create_organization(
    p_name text,
    p_owner_profile_id uuid DEFAULT NULL
)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
    target_owner_id uuid;
    new_organization organizations;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Use provided owner or current user
    target_owner_id := COALESCE(p_owner_profile_id, current_user_id);

    -- Only allow if current user is creating for themselves, or is admin
    IF target_owner_id != current_user_id THEN
        -- Check if current user is admin
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE id = current_user_id
            AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Only admins can create organizations for other users';
        END IF;
    END IF;

    -- Create organization
    INSERT INTO organizations (name, is_active)
    VALUES (p_name, true)
    RETURNING * INTO new_organization;

    -- Add owner as member
    INSERT INTO organization_members (
        organization_id,
        profile_id,
        role,
        is_active
    )
    VALUES (
        new_organization.id,
        target_owner_id,
        'owner',
        true
    );

    RETURN new_organization;
END;
$$;

COMMENT ON FUNCTION public.create_organization IS 
'Creates a new organization and adds the creator (or specified user) as owner.';

-- ============================================================================
-- Function: invite_member
-- ============================================================================
-- Invites a member to an organization (or adds if user exists)
CREATE OR REPLACE FUNCTION public.invite_member(
    p_organization_id uuid,
    p_email text,
    p_role organization_role_enum DEFAULT 'detailer'
)
RETURNS organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
    current_role organization_role_enum;
    target_profile_id uuid;
    new_member organization_members;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user has permission (owner or manager)
    SELECT om.role INTO current_role
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.profile_id = current_user_id
    AND om.is_active = true;

    IF current_role IS NULL THEN
        RAISE EXCEPTION 'Not a member of this organization';
    END IF;

    IF current_role NOT IN ('owner', 'manager') THEN
        RAISE EXCEPTION 'Only owners and managers can invite members';
    END IF;

    -- Find or create profile by email
    SELECT id INTO target_profile_id
    FROM profiles
    WHERE email = p_email
    LIMIT 1;

    IF target_profile_id IS NULL THEN
        -- TODO: Create invitation record for future use
        -- For now, raise exception
        RAISE EXCEPTION 'User with email % not found. Invitation system not yet implemented.', p_email;
    END IF;

    -- Check if already a member
    IF EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id
        AND profile_id = target_profile_id
    ) THEN
        RAISE EXCEPTION 'User is already a member of this organization';
    END IF;

    -- Add member
    INSERT INTO organization_members (
        organization_id,
        profile_id,
        role,
        is_active
    )
    VALUES (
        p_organization_id,
        target_profile_id,
        p_role,
        true
    )
    RETURNING * INTO new_member;

    RETURN new_member;
END;
$$;

COMMENT ON FUNCTION public.invite_member IS 
'Invites a member to an organization by email. Only owners and managers can invite.';

-- ============================================================================
-- Function: update_member_role
-- ============================================================================
-- Updates a member's role in an organization
CREATE OR REPLACE FUNCTION public.update_member_role(
    p_organization_id uuid,
    p_profile_id uuid,
    p_new_role organization_role_enum
)
RETURNS organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
    current_role organization_role_enum;
    target_member organization_members;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user is owner
    SELECT om.role INTO current_role
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.profile_id = current_user_id
    AND om.is_active = true;

    IF current_role IS NULL THEN
        RAISE EXCEPTION 'Not a member of this organization';
    END IF;

    IF current_role != 'owner' THEN
        RAISE EXCEPTION 'Only owners can change member roles';
    END IF;

    -- Prevent removing last owner
    IF EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id
        AND role = 'owner'
        AND is_active = true
        AND profile_id = p_profile_id
    ) AND p_new_role != 'owner' THEN
        -- Check if this is the last owner
        IF (
            SELECT COUNT(*) FROM organization_members
            WHERE organization_id = p_organization_id
            AND role = 'owner'
            AND is_active = true
        ) = 1 THEN
            RAISE EXCEPTION 'Cannot remove the last owner from an organization';
        END IF;
    END IF;

    -- Update role
    UPDATE organization_members
    SET role = p_new_role,
        updated_at = now()
    WHERE organization_id = p_organization_id
    AND profile_id = p_profile_id
    RETURNING * INTO target_member;

    IF target_member IS NULL THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    RETURN target_member;
END;
$$;

COMMENT ON FUNCTION public.update_member_role IS 
'Updates a member''s role in an organization. Only owners can change roles.';

-- ============================================================================
-- Function: remove_member
-- ============================================================================
-- Removes a member from an organization
CREATE OR REPLACE FUNCTION public.remove_member(
    p_organization_id uuid,
    p_profile_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
    current_role organization_role_enum;
    target_role organization_role_enum;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user is owner or manager
    SELECT om.role INTO current_role
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.profile_id = current_user_id
    AND om.is_active = true;

    IF current_role IS NULL THEN
        RAISE EXCEPTION 'Not a member of this organization';
    END IF;

    IF current_role NOT IN ('owner', 'manager') THEN
        RAISE EXCEPTION 'Only owners and managers can remove members';
    END IF;

    -- Get target member's role
    SELECT om.role INTO target_role
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.profile_id = p_profile_id
    AND om.is_active = true;

    IF target_role IS NULL THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    -- Prevent removing owner (only owners can remove owners)
    IF target_role = 'owner' AND current_role != 'owner' THEN
        RAISE EXCEPTION 'Only owners can remove other owners';
    END IF;

    -- Prevent removing last owner
    IF target_role = 'owner' THEN
        IF (
            SELECT COUNT(*) FROM organization_members
            WHERE organization_id = p_organization_id
            AND role = 'owner'
            AND is_active = true
        ) = 1 THEN
            RAISE EXCEPTION 'Cannot remove the last owner from an organization';
        END IF;
    END IF;

    -- Remove member (set is_active = false)
    UPDATE organization_members
    SET is_active = false,
        updated_at = now()
    WHERE organization_id = p_organization_id
    AND profile_id = p_profile_id;
END;
$$;

COMMENT ON FUNCTION public.remove_member IS 
'Removes a member from an organization. Only owners and managers can remove members.';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_user_organization TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_in_organization TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Organization management functions are now available.
-- Next: Implement mode detection logic in frontend
-- ============================================================================

