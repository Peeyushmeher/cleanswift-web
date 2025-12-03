'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface AddressData {
  address_line1: string;
  address_line2?: string;
  city: string;
  province: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
}

export interface DetailerOnboardingData {
  // Step 0: Account Information (for new users)
  email?: string;
  password?: string;
  
  // Step 1: Basic Information
  full_name: string;
  phone: string;
  years_experience: number;
  
  // Step 2: Location & Service Area
  address: AddressData;
  service_radius_km?: number;
  
  // Step 3: Profile Details
  bio?: string;
  specialties?: string[];
  avatar_url?: string;
}

export interface OrganizationOnboardingData {
  // Account info (for new users)
  email?: string;
  password?: string;
  
  // Organization info
  organization_name: string;
  organization_description?: string;
  business_logo_url?: string;
  
  // Owner detailer info (same as DetailerOnboardingData)
  owner_detailer: DetailerOnboardingData;
}

/**
 * Geocode an address to get latitude/longitude
 * For now, returns null - can be enhanced with Google Maps API or similar
 */
export async function geocodeAddress(address: AddressData): Promise<{ latitude: number; longitude: number } | null> {
  // TODO: Implement geocoding with Google Maps API or similar service
  // For now, return null - the address can be geocoded later or manually
  return null;
}

/**
 * Create a user address record
 */
export async function createUserAddress(
  address: AddressData,
  name: string = 'Home'
): Promise<{ success: boolean; error?: string; addressId?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Geocode address if not provided
    let { latitude, longitude } = address;
    if (!latitude || !longitude) {
      const geocoded = await geocodeAddress(address);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }

    const { data, error } = await supabase
      .from('user_addresses')
      .insert({
        user_id: user.id,
        name,
        address_line1: address.address_line1,
        address_line2: address.address_line2 || null,
        city: address.city,
        province: address.province,
        postal_code: address.postal_code,
        latitude: latitude || null,
        longitude: longitude || null,
        is_default: true, // First address from onboarding is default
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating user address:', error);
      return { success: false, error: error.message };
    }

    return { success: true, addressId: data.id };
  } catch (error: any) {
    console.error('Error in createUserAddress:', error);
    return { success: false, error: error.message || 'Failed to create address' };
  }
}

/**
 * Update profile onboarding_completed flag
 */
export async function updateProfileOnboarding(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile onboarding:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateProfileOnboarding:', error);
    return { success: false, error: error.message || 'Failed to update profile' };
  }
}

/**
 * Create detailer profile with full onboarding data
 */
export async function createDetailerProfile(
  data: DetailerOnboardingData,
  organizationId?: string
): Promise<{ success: boolean; error?: string; detailerId?: string }> {
  try {
    const supabase = await createClient();
    let { data: { user } } = await supabase.auth.getUser();
    
    // If user is not authenticated and we have email/password, create account
    if (!user && data.email && data.password) {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            phone: data.phone,
          },
        },
      });

      if (signUpError) {
        return { success: false, error: signUpError.message || 'Failed to create account' };
      }

      if (!authData.user) {
        return { success: false, error: 'Account creation failed' };
      }

      user = authData.user;
      
      // Create profile using RPC function (bypasses RLS, works without email confirmation)
      const { error: profileError } = await supabase.rpc('create_profile_after_signup', {
        p_user_id: user.id,
        p_email: data.email,
        p_full_name: data.full_name,
        p_phone: data.phone,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return { success: false, error: profileError.message || 'Failed to create profile' };
      }
    }
    
    if (!user) {
      return { success: false, error: 'Not authenticated. Please provide email and password.' };
    }

    // Step 1: Update profile phone if needed (only if user is authenticated)
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ phone: data.phone })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile phone:', profileError);
        // Don't fail, continue with detailer creation
      }
    }

    // Step 2: Create detailer profile via RPC
    // Use the version that accepts user_id if we don't have a session
    let detailer;
    let createError;
    
    if (currentUser) {
      // User is authenticated, use the regular function
      const result = await supabase.rpc('create_detailer_profile', {
        p_full_name: data.full_name,
        p_years_experience: data.years_experience,
        p_avatar_url: data.avatar_url || null,
      });
      detailer = result.data;
      createError = result.error;
    } else {
      // User is not authenticated (email not confirmed), use the version with user_id
      const result = await supabase.rpc('create_detailer_profile_with_user_id', {
        p_user_id: user.id,
        p_full_name: data.full_name,
        p_years_experience: data.years_experience,
        p_avatar_url: data.avatar_url || null,
      });
      detailer = result.data;
      createError = result.error;
    }

    if (createError) {
      console.error('Error creating detailer profile:', createError);
      return { success: false, error: createError.message };
    }

    if (!detailer) {
      return { success: false, error: 'Failed to create detailer profile' };
    }

    // Step 3: Update detailer with additional fields (location, bio, specialties, service_radius, organization)
    // Use service client if available, otherwise skip (can be updated later after email confirmation)
    const updateData: any = {};
    
    if (data.address.latitude && data.address.longitude) {
      updateData.latitude = data.address.latitude;
      updateData.longitude = data.address.longitude;
    }
    
    if (data.service_radius_km) {
      updateData.service_radius_km = data.service_radius_km;
    }
    
    if (data.bio) {
      updateData.bio = data.bio;
    }
    
    if (data.specialties && data.specialties.length > 0) {
      updateData.specialties = data.specialties;
    }

    if (organizationId) {
      updateData.organization_id = organizationId;
    }

    // Try to update detailer if we have a session, otherwise skip (can be updated after email confirmation)
    if (Object.keys(updateData).length > 0 && currentUser) {
      const { error: updateError } = await supabase
        .from('detailers')
        .update(updateData)
        .eq('id', detailer.id);

      if (updateError) {
        console.error('Error updating detailer additional fields:', updateError);
        // Don't fail the whole operation, these can be updated later
      }
    } else if (Object.keys(updateData).length > 0) {
      console.warn('Skipping detailer field updates - user not authenticated (email confirmation required). These can be updated after email confirmation.');
    }

    // Step 4: Create user address (only if authenticated, otherwise skip)
    if (currentUser) {
      const addressResult = await createUserAddress(data.address, 'Home');
      if (!addressResult.success) {
        console.error('Error creating user address:', addressResult.error);
        // Don't fail the whole operation, address can be added later
      }
    } else {
      console.warn('Skipping address creation - user not authenticated (email confirmation required). Address can be added after email confirmation.');
    }

    // Step 5: Mark onboarding as completed using RPC (works without session)
    const { error: onboardingError } = await supabase.rpc('update_profile_onboarding_completed', {
      p_user_id: user.id,
    });

    if (onboardingError) {
      // If the RPC doesn't exist, try the direct update (might fail due to RLS)
      const { error: directError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      
      if (directError) {
        console.error('Error updating onboarding status:', directError);
        // Don't fail - this can be updated later
      }
    }

    return { success: true, detailerId: detailer.id };
  } catch (error: any) {
    console.error('Error in createDetailerProfile:', error);
    return { success: false, error: error.message || 'Failed to create detailer profile' };
  }
}

/**
 * Create organization and owner detailer profile
 */
export async function createOrganization(
  data: OrganizationOnboardingData
): Promise<{ success: boolean; error?: string; organizationId?: string; detailerId?: string }> {
  try {
    const supabase = await createClient();
    let { data: { user } } = await supabase.auth.getUser();
    
    // If user is not authenticated and we have email/password, create account
    if (!user && data.email && data.password) {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.owner_detailer.full_name,
            phone: data.owner_detailer.phone,
          },
        },
      });

      if (signUpError) {
        return { success: false, error: signUpError.message || 'Failed to create account' };
      }

      if (!authData.user) {
        return { success: false, error: 'Account creation failed' };
      }

      user = authData.user;
      
      // Create profile using RPC function (bypasses RLS, works without email confirmation)
      const { error: profileError } = await supabase.rpc('create_profile_after_signup', {
        p_user_id: user.id,
        p_email: data.email,
        p_full_name: data.owner_detailer.full_name,
        p_phone: data.owner_detailer.phone,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return { success: false, error: profileError.message || 'Failed to create profile' };
      }
    }
    
    if (!user) {
      return { success: false, error: 'Not authenticated. Please provide email and password.' };
    }

    // Step 1: Create organization via RPC (needs to be updated to accept user_id if not authenticated)
    // For now, organization creation requires authentication, so we'll need to handle this
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      // If user is not authenticated, we can't create organization yet
      // Return error asking user to confirm email first
      return { 
        success: false, 
        error: 'Please confirm your email address before creating an organization. Check your inbox for a confirmation email.' 
      };
    }
    
    const { data: organization, error: orgError } = await supabase.rpc('create_organization', {
      p_name: data.organization_name,
      p_owner_profile_id: user.id,
    });

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return { success: false, error: orgError.message };
    }

    if (!organization) {
      return { success: false, error: 'Failed to create organization' };
    }

    // Step 2: Update organization with description and logo if provided
    const orgUpdateData: any = {};
    if (data.organization_description) {
      orgUpdateData.description = data.organization_description;
    }
    if (data.business_logo_url) {
      orgUpdateData.business_logo_url = data.business_logo_url;
    }

    if (Object.keys(orgUpdateData).length > 0) {
      const { error: orgUpdateError } = await supabase
        .from('organizations')
        .update(orgUpdateData)
        .eq('id', organization.id);

      if (orgUpdateError) {
        console.error('Error updating organization details:', orgUpdateError);
        // Don't fail the whole operation
      }
    }

    // Step 3: Create owner detailer profile with organization_id
    const detailerResult = await createDetailerProfile(
      data.owner_detailer,
      organization.id
    );

    if (!detailerResult.success) {
      // If detailer creation fails, we should probably clean up the organization
      // For now, just return the error
      return { success: false, error: detailerResult.error };
    }

    return {
      success: true,
      organizationId: organization.id,
      detailerId: detailerResult.detailerId,
    };
  } catch (error: any) {
    console.error('Error in createOrganization:', error);
    return { success: false, error: error.message || 'Failed to create organization' };
  }
}
