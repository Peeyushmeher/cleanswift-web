'use server';

import { createClient } from '@/lib/supabase/server';
import { requireDetailer } from '@/lib/auth';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canManageMembers, canChangeMemberRoles, canRemoveMembers } from '@/lib/detailer/permissions';

/**
 * Invite a member to the organization
 */
export async function inviteMember(
  organizationId: string,
  email: string,
  role: 'detailer' | 'dispatcher' | 'manager' | 'owner'
) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const organization = await getDetailerOrganization();
  if (!organization || organization.id !== organizationId) {
    throw new Error('Organization not found');
  }

  const userRole = await getOrganizationRole(organizationId);
  if (!canManageMembers(userRole)) {
    throw new Error('You do not have permission to invite members');
  }

  // Only owners can invite owners
  if (role === 'owner' && userRole !== 'owner') {
    throw new Error('Only owners can invite other owners');
  }

  // Call RPC function
  const { data, error } = await supabase.rpc('invite_member', {
    p_organization_id: organizationId,
    p_email: email,
    p_role: role,
  });

  if (error) {
    throw new Error(error.message || 'Failed to invite member');
  }

  return data;
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  organizationId: string,
  profileId: string,
  newRole: 'detailer' | 'dispatcher' | 'manager' | 'owner'
) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const userRole = await getOrganizationRole(organizationId);
  if (!canChangeMemberRoles(userRole)) {
    throw new Error('You do not have permission to change member roles');
  }

  // Call RPC function
  const { error } = await supabase.rpc('update_member_role', {
    p_organization_id: organizationId,
    p_profile_id: profileId,
    p_new_role: newRole,
  });

  if (error) {
    throw new Error(error.message || 'Failed to update member role');
  }

  return { success: true };
}

/**
 * Suspend a member (set is_active = false)
 */
export async function suspendMember(organizationId: string, profileId: string) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const userRole = await getOrganizationRole(organizationId);
  if (!canRemoveMembers(userRole)) {
    throw new Error('You do not have permission to suspend members');
  }

  // Prevent suspending yourself
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === profileId) {
    throw new Error('You cannot suspend yourself');
  }

  // Update member
  const { error } = await supabase
    .from('organization_members')
    .update({ is_active: false })
    .eq('organization_id', organizationId)
    .eq('profile_id', profileId);

  if (error) {
    throw new Error('Failed to suspend member');
  }

  return { success: true };
}

/**
 * Activate a member (set is_active = true)
 */
export async function activateMember(organizationId: string, profileId: string) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const userRole = await getOrganizationRole(organizationId);
  if (!canRemoveMembers(userRole)) {
    throw new Error('You do not have permission to activate members');
  }

  // Update member
  const { error } = await supabase
    .from('organization_members')
    .update({ is_active: true })
    .eq('organization_id', organizationId)
    .eq('profile_id', profileId);

  if (error) {
    throw new Error('Failed to activate member');
  }

  return { success: true };
}

/**
 * Remove a member from the organization
 */
export async function removeMember(organizationId: string, profileId: string) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const userRole = await getOrganizationRole(organizationId);
  if (!canRemoveMembers(userRole)) {
    throw new Error('You do not have permission to remove members');
  }

  // Prevent removing yourself
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === profileId) {
    throw new Error('You cannot remove yourself');
  }

  // Call RPC function
  const { error } = await supabase.rpc('remove_member', {
    p_organization_id: organizationId,
    p_profile_id: profileId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to remove member');
  }

  return { success: true };
}

