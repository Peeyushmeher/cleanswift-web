'use server';

import { createClient } from '@/lib/supabase/server';
import { requireDetailer } from '@/lib/auth';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canManageTeams } from '@/lib/detailer/permissions';

/**
 * Create a new team
 */
export async function createTeam(
  organizationId: string,
  name: string,
  description: string | null,
  serviceArea: any,
  detailerIds: string[]
) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const organization = await getDetailerOrganization();
  if (!organization || organization.id !== organizationId) {
    throw new Error('Organization not found');
  }

  const userRole = await getOrganizationRole(organizationId);
  if (!canManageTeams(userRole)) {
    throw new Error('You do not have permission to create teams');
  }

  // Create team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      organization_id: organizationId,
      name,
      description,
      service_area: serviceArea,
      is_active: true,
    })
    .select()
    .single();

  if (teamError || !team) {
    throw new Error('Failed to create team');
  }

  // Add team members
  if (detailerIds.length > 0) {
    const { error: membersError } = await supabase
      .from('team_members')
      .insert(
        detailerIds.map((detailerId) => ({
          team_id: team.id,
          detailer_id: detailerId,
        }))
      );

    if (membersError) {
      console.error('Failed to add team members:', membersError);
      // Don't throw - team was created
    }
  }

  return team;
}

/**
 * Update a team
 */
export async function updateTeam(
  teamId: string,
  name: string,
  description: string | null,
  serviceArea: any,
  detailerIds: string[]
) {
  const supabase = await createClient();
  await requireDetailer();

  // Get team to verify organization
  const { data: team } = await supabase
    .from('teams')
    .select('organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    throw new Error('Team not found');
  }

  // Check permissions
  const userRole = await getOrganizationRole(team.organization_id);
  if (!canManageTeams(userRole)) {
    throw new Error('You do not have permission to update teams');
  }

  // Update team
  const { error: updateError } = await supabase
    .from('teams')
    .update({
      name,
      description,
      service_area: serviceArea,
    })
    .eq('id', teamId);

  if (updateError) {
    throw new Error('Failed to update team');
  }

  // Update team members
  // Remove all existing members
  await supabase.from('team_members').delete().eq('team_id', teamId);

  // Add new members
  if (detailerIds.length > 0) {
    const { error: membersError } = await supabase
      .from('team_members')
      .insert(
        detailerIds.map((detailerId) => ({
          team_id: teamId,
          detailer_id: detailerId,
        }))
      );

    if (membersError) {
      console.error('Failed to update team members:', membersError);
    }
  }

  return { success: true };
}

/**
 * Delete a team (soft delete)
 */
export async function deleteTeam(teamId: string) {
  const supabase = await createClient();
  await requireDetailer();

  // Get team to verify organization
  const { data: team } = await supabase
    .from('teams')
    .select('organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    throw new Error('Team not found');
  }

  // Check permissions
  const userRole = await getOrganizationRole(team.organization_id);
  if (!canManageTeams(userRole)) {
    throw new Error('You do not have permission to delete teams');
  }

  // Soft delete
  const { error } = await supabase
    .from('teams')
    .update({ is_active: false })
    .eq('id', teamId);

  if (error) {
    throw new Error('Failed to delete team');
  }

  return { success: true };
}

