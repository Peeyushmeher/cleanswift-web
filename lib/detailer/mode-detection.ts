import { createClient } from '@/lib/supabase/server';

export type DetailerMode = 'solo' | 'organization';

/**
 * Get the detailer mode (solo or organization) for a user
 * @param profileId - Optional profile ID, defaults to current authenticated user
 * @returns 'solo' if detailer has no organization, 'organization' if they belong to one
 */
export async function getDetailerMode(profileId?: string): Promise<DetailerMode> {
  const supabase = await createClient();
  
  // Get current user if profileId not provided
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !profileId) {
    throw new Error('Not authenticated');
  }

  const targetProfileId = profileId || user!.id;

  // Check if detailer has an organization
  const { data: detailer } = await supabase
    .from('detailers')
    .select('organization_id')
    .eq('profile_id', targetProfileId)
    .single();

  if (!detailer) {
    // No detailer record, assume solo
    return 'solo';
  }

  // If organization_id is set, they're in organization mode
  if (detailer.organization_id) {
    return 'organization';
  }

  return 'solo';
}

/**
 * Get organization details for a detailer
 * @param profileId - Optional profile ID, defaults to current authenticated user
 * @returns Organization object or null if solo
 */
export async function getDetailerOrganization(profileId?: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !profileId) {
    throw new Error('Not authenticated');
  }

  const targetProfileId = profileId || user!.id;

  // Use the RPC function to get organization
  const { data, error } = await supabase.rpc('get_user_organization', {
    p_profile_id: targetProfileId,
  });

  if (error) {
    console.error('Error getting organization:', error);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
}

/**
 * Get the user's role in their organization
 * @param organizationId - Organization ID
 * @param profileId - Optional profile ID, defaults to current authenticated user
 * @returns Role enum or null if not a member
 */
export async function getOrganizationRole(
  organizationId: string,
  profileId?: string
) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !profileId) {
    throw new Error('Not authenticated');
  }

  const targetProfileId = profileId || user!.id;

  const { data, error } = await supabase.rpc('get_user_role_in_organization', {
    p_profile_id: targetProfileId,
    p_organization_id: organizationId,
  });

  if (error) {
    console.error('Error getting organization role:', error);
    return null;
  }

  return data;
}

