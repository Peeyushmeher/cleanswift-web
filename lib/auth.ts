import { createClient } from './supabase/server';
import { redirect } from 'next/navigation';
import { getDetailerMode as getMode } from './detailer/mode-detection';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'user' | 'detailer' | 'admin';
  avatar_url: string | null;
}

/**
 * Get the current user's session and profile
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current user's profile with role
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const session = await getSession();

  if (!session?.user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, avatar_url')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Profile query error in getUserProfile:', error.message, error.code, error.details);
    return null;
  }
  
  if (!data) {
    console.error('No profile found for user:', session.user.id);
    return null;
  }

  return data as UserProfile;
}

/**
 * Check if user is authenticated, redirect to login if not
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }
  return session;
}

/**
 * Check if user has detailer role, redirect if not
 */
export async function requireDetailer() {
  const profile = await getUserProfile();
  if (!profile || (profile.role !== 'detailer' && profile.role !== 'admin')) {
    redirect('/auth/login');
  }
  return profile;
}

/**
 * Check if user has admin role, redirect if not
 */
export async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || profile.role !== 'admin') {
    redirect('/auth/login');
  }
  return profile;
}

/**
 * Get the detailer mode (solo or organization)
 * @param profileId - Optional profile ID, defaults to current authenticated user
 * @returns 'solo' if detailer has no organization, 'organization' if they belong to one
 */
export async function getDetailerMode(profileId?: string) {
  return getMode(profileId);
}

