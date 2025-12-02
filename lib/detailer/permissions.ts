/**
 * Permission utilities for role-based access control
 * Defines what each role can do in the organization
 */

export enum OrganizationRole {
  Owner = 'owner',
  Manager = 'manager',
  Dispatcher = 'dispatcher',
  Detailer = 'detailer',
}

export type OrganizationRoleType = 'owner' | 'manager' | 'dispatcher' | 'detailer';

/**
 * Check if a role can assign jobs
 */
export function canAssignJobs(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager || role === OrganizationRole.Dispatcher;
}

/**
 * Check if a role can manage teams
 */
export function canManageTeams(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager;
}

/**
 * Check if a role can manage members
 */
export function canManageMembers(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager;
}

/**
 * Check if a role can view organization earnings
 */
export function canViewOrgEarnings(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager;
}

/**
 * Check if a role can manage organization settings
 */
export function canManageOrgSettings(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner;
}

/**
 * Check if a role can change member roles
 */
export function canChangeMemberRoles(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner;
}

/**
 * Check if a role can remove members
 */
export function canRemoveMembers(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager;
}

/**
 * Check if a role can view all organization bookings
 */
export function canViewAllOrgBookings(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager || role === OrganizationRole.Dispatcher;
}

/**
 * Check if a role can update booking status
 */
export function canUpdateBookingStatus(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager || role === OrganizationRole.Dispatcher;
}

/**
 * Check if a role can create payout batches
 */
export function canCreatePayoutBatches(role: OrganizationRoleType | null): boolean {
  if (!role) return false;
  return role === OrganizationRole.Owner || role === OrganizationRole.Manager;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: OrganizationRoleType | null) {
  return {
    canAssignJobs: canAssignJobs(role),
    canManageTeams: canManageTeams(role),
    canManageMembers: canManageMembers(role),
    canViewOrgEarnings: canViewOrgEarnings(role),
    canManageOrgSettings: canManageOrgSettings(role),
    canChangeMemberRoles: canChangeMemberRoles(role),
    canRemoveMembers: canRemoveMembers(role),
    canViewAllOrgBookings: canViewAllOrgBookings(role),
    canUpdateBookingStatus: canUpdateBookingStatus(role),
    canCreatePayoutBatches: canCreatePayoutBatches(role),
  };
}

