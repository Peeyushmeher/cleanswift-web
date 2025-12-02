'use server';

import { createClient } from '@/lib/supabase/server';
import { requireDetailer } from '@/lib/auth';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canManageOrgSettings } from '@/lib/detailer/permissions';

/**
 * Update organization profile
 */
export async function updateOrganizationProfile(
  organizationId: string,
  name: string,
  description: string | null
) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const organization = await getDetailerOrganization();
  if (!organization || organization.id !== organizationId) {
    throw new Error('Organization not found');
  }

  const userRole = await getOrganizationRole(organizationId);
  if (!canManageOrgSettings(userRole)) {
    throw new Error('You do not have permission to update organization settings');
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      name,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    throw new Error('Failed to update organization profile');
  }

  return { success: true };
}

/**
 * Add a service zone
 */
export async function addServiceZone(organizationId: string, zoneData: any) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const userRole = await getOrganizationRole(organizationId);
  if (!canManageOrgSettings(userRole)) {
    throw new Error('You do not have permission to manage service zones');
  }

  // Get current organization
  const { data: org } = await supabase
    .from('organizations')
    .select('service_area')
    .eq('id', organizationId)
    .single();

  const currentZones = (org?.service_area as any[]) || [];
  const updatedZones = [...currentZones, zoneData];

  const { error } = await supabase
    .from('organizations')
    .update({
      service_area: updatedZones,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    throw new Error('Failed to add service zone');
  }

  return { success: true };
}

/**
 * Delete a service zone
 */
export async function deleteServiceZone(organizationId: string, zoneIndex: number) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const userRole = await getOrganizationRole(organizationId);
  if (!canManageOrgSettings(userRole)) {
    throw new Error('You do not have permission to manage service zones');
  }

  // Get current organization
  const { data: org } = await supabase
    .from('organizations')
    .select('service_area')
    .eq('id', organizationId)
    .single();

  const currentZones = (org?.service_area as any[]) || [];
  const updatedZones = currentZones.filter((_, idx) => idx !== zoneIndex);

  const { error } = await supabase
    .from('organizations')
    .update({
      service_area: updatedZones,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    throw new Error('Failed to delete service zone');
  }

  return { success: true };
}

/**
 * Update business hours
 */
export async function updateBusinessHours(organizationId: string, hours: any) {
  const supabase = await createClient();
  await requireDetailer();

  // Check permissions
  const userRole = await getOrganizationRole(organizationId);
  if (!canManageOrgSettings(userRole)) {
    throw new Error('You do not have permission to update business hours');
  }

  // For now, store in a JSONB column or separate table
  // This is a placeholder implementation
  const { error } = await supabase
    .from('organizations')
    .update({
      business_hours: hours,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    throw new Error('Failed to update business hours');
  }

  return { success: true };
}

