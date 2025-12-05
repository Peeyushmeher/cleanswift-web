import type { UserProfile } from '@/lib/auth';
import { getUserProfile } from '@/lib/auth';

export class ApiAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchProfile() {
  const profile = await getUserProfile();
  if (!profile) {
    throw new ApiAuthError(401, 'Authentication required');
  }
  return profile;
}

export async function requireApiUser() {
  return fetchProfile();
}

export async function requireApiDetailer() {
  const profile = await fetchProfile();
  if (profile.role !== 'detailer' && profile.role !== 'admin') {
    throw new ApiAuthError(403, 'Detailer access required');
  }
  return profile;
}

export async function requireApiAdmin() {
  const profile = await fetchProfile();
  if (profile.role !== 'admin') {
    throw new ApiAuthError(403, 'Admin access required');
  }
  return profile;
}

export function ensureRole(profile: UserProfile, allowedRoles: UserProfile['role'][]) {
  if (!allowedRoles.includes(profile.role)) {
    throw new ApiAuthError(403, 'Insufficient permissions');
  }
}

export function mapApiError(error: unknown) {
  if (error instanceof ApiAuthError) {
    return {
      status: error.status,
      body: { error: error.message },
    };
  }

  console.error('API handler error:', error);
  return {
    status: 500,
    body: { error: 'Internal server error' },
  };
}

