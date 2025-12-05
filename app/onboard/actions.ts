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

export interface AvailabilitySlot {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // HH:mm:ss format
  end_time: string; // HH:mm:ss format
  lunch_start_time?: string; // HH:mm:ss format (optional)
  lunch_end_time?: string; // HH:mm:ss format (optional)
}

export interface DayOff {
  date: string; // YYYY-MM-DD format
  reason?: string;
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
  
  // Step 3: Pricing Model
  pricing_model?: 'subscription' | 'percentage' | null;
  
  // Step 4: Profile Details
  bio?: string;
  specialties?: string[];
  avatar_url?: string;
  
  // Step 5: Availability Hours
  availability?: AvailabilitySlot[];
  daysOff?: DayOff[];
}

export interface ServiceAreaZone {
  name: string;
  city: string;
  province: string;
  postal_codes?: string[];
}

export interface BusinessHours {
  [key: string]: { start: string; end: string; active: boolean };
}

export interface OrganizationOnboardingData {
  // Account info (for new users)
  email?: string;
  password?: string;
  
  // Organization info
  organization_name: string;
  organization_description?: string;
  business_logo_url?: string;
  service_area?: ServiceAreaZone[];
  business_hours?: BusinessHours;
  
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
    // Use service client to save all data regardless of authentication status
    const updateData: any = {};
    
    // Always set service_radius_km (use actual value, default to 50 if not provided)
    if (data.service_radius_km !== undefined && data.service_radius_km !== null) {
      updateData.service_radius_km = data.service_radius_km;
    } else {
      updateData.service_radius_km = 50; // Default
    }
    
    // Set location if address has coordinates
    if (data.address?.latitude && data.address?.longitude) {
      updateData.latitude = data.address.latitude;
      updateData.longitude = data.address.longitude;
    }
    
    // Set bio if provided
    if (data.bio && data.bio.trim().length > 0) {
      updateData.bio = data.bio.trim();
    }
    
    // Set specialties if provided
    if (data.specialties && Array.isArray(data.specialties) && data.specialties.length > 0) {
      updateData.specialties = data.specialties;
    }
    
    // Set pricing model if provided
    if (data.pricing_model) {
      updateData.pricing_model = data.pricing_model;
    }

    // Set organization if provided
    if (organizationId) {
      updateData.organization_id = organizationId;
    }
    
    console.log('Prepared updateData for detailer:', {
      detailerId: detailer.id,
      updateData,
      hasAddress: !!data.address,
      addressData: data.address,
      formData: {
        service_radius_km: data.service_radius_km,
        bio: data.bio,
        specialties: data.specialties,
        pricing_model: data.pricing_model,
      }
    });

    // Use service client to update detailer fields (bypasses RLS, works without authentication)
    if (Object.keys(updateData).length > 0) {
      try {
        const serviceClient = createServiceClient();
        console.log('Updating detailer with data:', { detailerId: detailer.id, updateData });
        const { data: updatedDetailer, error: updateError } = await serviceClient
          .from('detailers')
          .update(updateData)
          .eq('id', detailer.id)
          .select();

        if (updateError) {
          console.error('Error updating detailer additional fields:', updateError);
          // Don't fail the whole operation, these can be updated later
        } else {
          console.log('Successfully updated detailer:', updatedDetailer);
        }
      } catch (serviceError: any) {
        console.error('Error creating service client for detailer update:', serviceError);
        console.error('Service error details:', serviceError?.message, serviceError?.stack);
        // Don't fail the whole operation
      }
    } else {
      console.warn('No update data to save for detailer:', detailer.id, 'Form data:', {
        hasAddress: !!data.address,
        hasSpecialties: !!(data.specialties && data.specialties.length > 0),
        hasBio: !!data.bio,
        serviceRadius: data.service_radius_km,
      });
    }

    // Step 4: Create user address using service client (bypasses RLS, works without authentication)
    try {
      const serviceClient = createServiceClient();
      
      // Geocode address if not provided
      let { latitude, longitude } = data.address;
      if (!latitude || !longitude) {
        const geocoded = await geocodeAddress(data.address);
        if (geocoded) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
        }
      }

      const addressData = {
        user_id: user.id, // This is the profile_id (profiles.id = auth.users.id)
        name: 'Home',
        address_line1: data.address.address_line1,
        address_line2: data.address.address_line2 || null,
        city: data.address.city,
        province: data.address.province,
        postal_code: data.address.postal_code,
        latitude: latitude || null,
        longitude: longitude || null,
        is_default: true, // First address from onboarding is default
      };

      console.log('Creating user address with data:', { userId: user.id, addressData });
      const { data: createdAddress, error: addressError } = await serviceClient
        .from('user_addresses')
        .insert(addressData)
        .select();

      if (addressError) {
        console.error('Error creating user address:', addressError);
        // Don't fail the whole operation, address can be added later
      } else {
        console.log('Successfully created user address:', createdAddress);
      }
    } catch (serviceError: any) {
      console.error('Error creating service client for address creation:', serviceError);
      console.error('Service error details:', serviceError?.message, serviceError?.stack);
      // Don't fail the whole operation
    }

    // Step 5: Create availability records if provided (only if authenticated)
    if (data.availability && data.availability.length > 0 && currentUser) {
      for (const slot of data.availability) {
        const { error: availabilityError } = await supabase.rpc('set_detailer_availability', {
          p_day_of_week: slot.day_of_week,
          p_start_time: slot.start_time,
          p_end_time: slot.end_time,
          p_is_active: true,
          p_lunch_start_time: slot.lunch_start_time || null,
          p_lunch_end_time: slot.lunch_end_time || null,
        });

        if (availabilityError) {
          console.error('Error creating availability slot:', availabilityError);
          // Don't fail the whole operation, availability can be added later
        }
      }
    } else if (data.availability && data.availability.length > 0) {
      console.warn('Skipping availability creation - user not authenticated (email confirmation required). Availability can be added after email confirmation.');
    }

    // Step 5b: Create days off records if provided (only if authenticated)
    if (data.daysOff && data.daysOff.length > 0 && currentUser) {
      for (const dayOff of data.daysOff) {
        const { error: dayOffError } = await supabase.rpc('add_detailer_day_off', {
          p_date: dayOff.date,
          p_reason: dayOff.reason || null,
        });

        if (dayOffError) {
          console.error('Error creating day off:', dayOffError);
          // Don't fail the whole operation, days off can be added later
        }
      }
    } else if (data.daysOff && data.daysOff.length > 0) {
      console.warn('Skipping days off creation - user not authenticated (email confirmation required). Days off can be added after email confirmation.');
    }

    // Step 6: Mark onboarding as completed using RPC (works without session)
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

    // Step 2: Update organization with description, logo, service_area, and business_hours if provided
    const orgUpdateData: any = {};
    if (data.organization_description) {
      orgUpdateData.description = data.organization_description;
    }
    if (data.business_logo_url) {
      orgUpdateData.business_logo_url = data.business_logo_url;
    }
    if (data.service_area && data.service_area.length > 0) {
      orgUpdateData.service_area = data.service_area;
    }
    if (data.business_hours && Object.keys(data.business_hours).length > 0) {
      orgUpdateData.business_hours = data.business_hours;
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
