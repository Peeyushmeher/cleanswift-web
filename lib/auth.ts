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
 * Uses getUser() instead of getSession() for secure authentication
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  // Get session after verifying user for compatibility
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  return session;
}

/**
 * Get the current user's profile with role
 * Uses getUser() for secure authentication
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  
  // Use getUser() instead of getSession() for secure authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, avatar_url')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Profile query error in getUserProfile:', error.message, error.code, error.details);
    return null;
  }
  
  if (!data) {
    console.error('No profile found for user:', user.id);
    return null;
  }

  return data as UserProfile;
}

/**
 * Check if user is authenticated, redirect to login if not
 * Uses getUser() for secure authentication
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/auth/login');
  }
  
  // Get session for compatibility
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
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
 * Check if user is an active detailer (has detailer role and is_active=true)
 * Redirects appropriately based on onboarding and approval status
 */
export async function requireActiveDetailer() {
  const profile = await getUserProfile();
  
  if (!profile || (profile.role !== 'detailer' && profile.role !== 'admin')) {
    redirect('/auth/login');
  }

  // Admins can always access
  if (profile.role === 'admin') {
    return profile;
  }

  const supabase = await createClient();
  
  // Check onboarding status
  const { data: profileData } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', profile.id)
    .single();

  // If onboarding not completed, redirect to onboarding
  if (!profileData?.onboarding_completed) {
    redirect('/onboard');
  }

  // Check detailer active status
  const { data: detailer } = await supabase
    .from('detailers')
    .select('is_active')
    .eq('profile_id', profile.id)
    .single();

  // If no detailer record, redirect to onboarding
  if (!detailer) {
    redirect('/onboard');
  }

  // If detailer is not active, redirect to pending page
  if (!detailer.is_active) {
    redirect('/detailer/pending');
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

