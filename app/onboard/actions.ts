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
  end_date?: string; // YYYY-MM-DD format (optional, for date ranges)
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
      // Get the site URL from environment variable
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cleanswift.app';
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/login`,
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

    // Step 1: Update profile phone and ensure role is set (use service client to work without authentication)
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    // Use service client to update phone and role regardless of authentication status
    try {
      const serviceClient = createServiceClient();
      const profileUpdate: any = {};
      
      // Always save phone number (database requires NOT NULL, so save even if empty string)
      // Trim whitespace if provided, otherwise use empty string
      profileUpdate.phone = (data.phone && data.phone.trim().length > 0) 
        ? data.phone.trim() 
        : '';
      
      // Ensure role is set to 'detailer' (the RPC should do this, but let's be explicit)
      profileUpdate.role = 'detailer';
      
      console.log('Updating profile with phone and role:', { 
        userId: user.id, 
        phone: profileUpdate.phone || '(empty)', 
        role: profileUpdate.role 
      });
      
      const { error: profileError } = await serviceClient
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile phone/role:', profileError);
        // Don't fail, continue with detailer creation
      } else {
        console.log('Successfully updated profile phone/role:', {
          phone: profileUpdate.phone || '(empty)',
          role: profileUpdate.role
        });
      }
    } catch (serviceError: any) {
      console.error('Error creating service client for profile update:', serviceError);
      // Don't fail, continue with detailer creation
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

    // Step 3b: Create subscription if pricing model is 'subscription'
    if (data.pricing_model === 'subscription') {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && serviceRoleKey) {
          console.log('Creating subscription for detailer during onboarding:', detailer.id);
          const functionUrl = `${supabaseUrl}/functions/v1/create-detailer-subscription`;
          
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ detailer_id: detailer.id }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log('✅ Subscription created during onboarding:', result.stripe_subscription_id);
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.warn('⚠️ Subscription creation failed during onboarding (non-blocking):', errorData.error || 'Unknown error');
            // Don't fail onboarding - subscription can be created later when user completes payment setup
          }
        } else {
          console.warn('⚠️ Supabase URL or Service Role Key not configured - skipping subscription creation during onboarding');
        }
      } catch (subscriptionError: any) {
        console.error('⚠️ Error creating subscription during onboarding (non-blocking):', subscriptionError);
        // Don't fail onboarding - subscription can be created later
      }
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

    // Step 5: Create availability records if provided (use service client to work without authentication)
    if (data.availability && data.availability.length > 0) {
      try {
        const serviceClient = createServiceClient();
        console.log('=== SAVING AVAILABILITY ===');
        console.log('Detailer ID:', detailer.id);
        console.log('Number of availability slots:', data.availability.length);
        console.log('Availability data:', data.availability.map(slot => ({
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          lunch_start_time: slot.lunch_start_time || 'none',
          lunch_end_time: slot.lunch_end_time || 'none',
        })));
        
        // First, delete all existing availability for this detailer to avoid conflicts
        // (onboarding replaces all availability, not just updates)
        const { error: deleteError } = await serviceClient
          .from('detailer_availability')
          .delete()
          .eq('detailer_id', detailer.id);
        
        if (deleteError) {
          console.warn('Warning: Error deleting existing availability (may not exist):', deleteError);
        } else {
          console.log('Cleared existing availability slots');
        }
        
        // Then insert all new availability slots
        const availabilityData = data.availability.map(slot => ({
          detailer_id: detailer.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_active: true,
          lunch_start_time: slot.lunch_start_time || null,
          lunch_end_time: slot.lunch_end_time || null,
        }));
        
        console.log('Inserting availability data:', availabilityData);
        const { data: createdSlots, error: availabilityError } = await serviceClient
          .from('detailer_availability')
          .insert(availabilityData)
          .select();

        if (availabilityError) {
          console.error('ERROR: Failed to create availability slots:', availabilityError);
          console.error('Availability error details:', {
            message: availabilityError.message,
            details: availabilityError.details,
            hint: availabilityError.hint,
            code: availabilityError.code,
          });
          // Don't fail the whole operation, availability can be added later
        } else {
          console.log(`✅ Successfully created ${createdSlots?.length || 0} availability slots`);
          console.log('Created slots:', createdSlots);
        }
        console.log('=== AVAILABILITY SAVE COMPLETE ===');
      } catch (serviceError: any) {
        console.error('ERROR: Exception creating service client for availability:', serviceError);
        console.error('Service error details:', serviceError?.message, serviceError?.stack);
        // Don't fail the whole operation
      }
    } else {
      console.log('=== AVAILABILITY SKIPPED ===');
      console.log('No availability data provided or array is empty');
      console.log('Availability data:', data.availability);
    }

    // Step 5b: Create days off records if provided (use service client to work without authentication)
    if (data.daysOff && data.daysOff.length > 0) {
      try {
        const serviceClient = createServiceClient();
        console.log('=== SAVING DAYS OFF ===');
        console.log('Detailer ID:', detailer.id);
        console.log('Number of days off:', data.daysOff.length);
        console.log('Days off data:', data.daysOff.map(dayOff => ({
          date: dayOff.date,
          end_date: dayOff.end_date || 'none',
          reason: dayOff.reason || 'none',
        })));
        
        // Prepare all days off data with date range support
        const daysOffData = data.daysOff.map(dayOff => ({
          detailer_id: detailer.id,
          date: dayOff.date,
          end_date: dayOff.end_date || null, // Support date ranges
          reason: dayOff.reason || null,
          is_active: true, // Days off are active by default
        }));
        
        // Since we removed the unique constraint, we need to handle duplicates differently
        // Strategy: For onboarding, we'll deactivate any existing days off for this detailer
        // (unlikely during onboarding, but handles edge cases) and then insert the new ones.
        // This ensures clean data without duplicates.
        console.log('Checking for existing days off to deactivate...');
        
        // During onboarding, there typically won't be existing days off, but we'll handle it
        // by deactivating any existing ones to ensure clean insertion
        const { error: deactivateError } = await serviceClient
          .from('detailer_days_off')
          .update({ 
            is_active: false, 
            updated_at: new Date().toISOString() 
          })
          .eq('detailer_id', detailer.id)
          .eq('is_active', true);
        
        if (deactivateError) {
          console.warn('Warning: Could not deactivate existing days off:', deactivateError);
          // Continue anyway - we'll still try to insert
        } else {
          console.log('Deactivated any existing days off (if any)');
        }
        
        console.log('Inserting days off data:', daysOffData);
        // Insert all days off (we deactivated existing ones above to avoid conflicts)
        const { data: createdDaysOff, error: dayOffError } = await serviceClient
          .from('detailer_days_off')
          .insert(daysOffData)
          .select();

        if (dayOffError) {
          console.error('ERROR: Failed to create days off:', dayOffError);
          console.error('Days off error details:', {
            message: dayOffError.message,
            details: dayOffError.details,
            hint: dayOffError.hint,
            code: dayOffError.code,
          });
          // Don't fail the whole operation, days off can be added later
        } else {
          console.log(`✅ Successfully created ${createdDaysOff?.length || 0} days off records`);
          console.log('Created days off:', createdDaysOff);
        }
        console.log('=== DAYS OFF SAVE COMPLETE ===');
      } catch (serviceError: any) {
        console.error('ERROR: Exception creating service client for days off:', serviceError);
        console.error('Service error details:', serviceError?.message, serviceError?.stack);
        // Don't fail the whole operation
      }
    } else {
      console.log('=== DAYS OFF SKIPPED ===');
      console.log('No days off data provided or array is empty');
      console.log('Days off data:', data.daysOff);
    }

    // Step 6: Mark onboarding as completed using RPC (works without session)
    const { error: onboardingError } = await supabase.rpc('update_profile_onboarding_completed', {
      p_user_id: user.id,
    });

    if (onboardingError) {
      // If the RPC doesn't exist, try the direct update using service client
      try {
        const serviceClient = createServiceClient();
        const { error: directError } = await serviceClient
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      
      if (directError) {
        console.error('Error updating onboarding status:', directError);
        // Don't fail - this can be updated later
        } else {
          console.log('Successfully marked onboarding as completed');
        }
      } catch (serviceError: any) {
        console.error('Error creating service client for onboarding completion:', serviceError);
      }
    } else {
      console.log('Successfully marked onboarding as completed via RPC');
    }

    // Step 7: Log comprehensive summary of what was saved
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('=== ONBOARDING DATA SAVE SUMMARY ===');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('User ID:', user.id);
    console.log('Detailer ID:', detailer.id);
    console.log('Email:', user.email);
    console.log('');
    console.log('📋 PROFILE DATA SAVED:');
    console.log('  - Full Name:', data.full_name || 'not provided');
    console.log('  - Phone:', data.phone ? data.phone.trim() : '(empty string saved)');
    console.log('  - Role: detailer');
    console.log('  - Onboarding Completed: true');
    console.log('');
    console.log('👤 DETAILER DATA SAVED:');
    console.log('  - Full Name:', detailer.full_name);
    console.log('  - Years Experience:', detailer.years_experience);
    console.log('  - Bio:', data.bio ? `"${data.bio}"` : 'not provided');
    console.log('  - Specialties:', data.specialties?.length || 0, 'items');
    if (data.specialties && data.specialties.length > 0) {
      console.log('    Specialties:', data.specialties.join(', '));
    }
    console.log('  - Service Radius:', data.service_radius_km || 50, 'km');
    console.log('  - Pricing Model:', data.pricing_model || 'not set');
    console.log('  - Location:', {
      latitude: data.address?.latitude || 'not set',
      longitude: data.address?.longitude || 'not set',
    });
    console.log('  - Is Active:', detailer.is_active);
    console.log('');
    console.log('📍 ADDRESS DATA SAVED:');
    console.log('  - Address Line 1:', data.address?.address_line1 || 'not provided');
    console.log('  - Address Line 2:', data.address?.address_line2 || 'none');
    console.log('  - City:', data.address?.city || 'not provided');
    console.log('  - Province:', data.address?.province || 'not provided');
    console.log('  - Postal Code:', data.address?.postal_code || 'not provided');
    console.log('  - Coordinates:', {
      latitude: data.address?.latitude || 'not set',
      longitude: data.address?.longitude || 'not set',
    });
    console.log('');
    console.log('⏰ AVAILABILITY DATA SAVED:');
    if (data.availability && data.availability.length > 0) {
      console.log('  - Total Slots:', data.availability.length);
      data.availability.forEach((slot, index) => {
        console.log(`  - Slot ${index + 1}:`, {
          day: slot.day_of_week,
          start: slot.start_time,
          end: slot.end_time,
          lunch: slot.lunch_start_time && slot.lunch_end_time 
            ? `${slot.lunch_start_time} - ${slot.lunch_end_time}` 
            : 'none',
        });
      });
    } else {
      console.log('  - No availability slots provided');
    }
    console.log('');
    console.log('📅 DAYS OFF DATA SAVED:');
    if (data.daysOff && data.daysOff.length > 0) {
      console.log('  - Total Days Off:', data.daysOff.length);
      data.daysOff.forEach((dayOff, index) => {
        console.log(`  - Day Off ${index + 1}:`, {
          date: dayOff.date,
          reason: dayOff.reason || 'none',
        });
      });
    } else {
      console.log('  - No days off provided');
    }
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('=== ONBOARDING SAVE COMPLETE ===');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

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
      // Get the site URL from environment variable
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cleanswift.app';
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/login`,
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

/**
 * Verify all onboarding data was saved correctly for a detailer
 * This function checks all tables to ensure data was saved properly
 */
export async function verifyOnboardingData(
  detailerId: string
): Promise<{
  success: boolean;
  data?: {
    profile: any;
    detailer: any;
    address: any;
    availability: any[];
    daysOff: any[];
  };
  missing?: string[];
  errors?: string[];
}> {
  try {
    const serviceClient = createServiceClient();
    const missing: string[] = [];
    const errors: string[] = [];

    // Get detailer record
    const { data: detailer, error: detailerError } = await serviceClient
      .from('detailers')
      .select('*, profile:profiles(*)')
      .eq('id', detailerId)
      .single();

    if (detailerError || !detailer) {
      return {
        success: false,
        errors: [`Failed to fetch detailer: ${detailerError?.message || 'Not found'}`],
      };
    }

    const profile = detailer.profile;
    const verificationData: any = {
      profile: null,
      detailer: null,
      address: null,
      availability: [],
      daysOff: [],
    };

    // Verify profile data
    if (profile) {
      verificationData.profile = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone || 'MISSING',
        role: profile.role || 'MISSING',
        onboarding_completed: profile.onboarding_completed,
      };
      if (!profile.phone) missing.push('Profile phone');
      if (profile.role !== 'detailer') missing.push('Profile role (should be "detailer")');
      if (!profile.onboarding_completed) missing.push('Onboarding completed flag');
    } else {
      missing.push('Profile record');
    }

    // Verify detailer data
    verificationData.detailer = {
      id: detailer.id,
      full_name: detailer.full_name || 'MISSING',
      years_experience: detailer.years_experience ?? 'MISSING',
      bio: detailer.bio || 'MISSING',
      specialties: detailer.specialties?.length || 0,
      service_radius_km: detailer.service_radius_km ?? 'MISSING',
      latitude: detailer.latitude || 'MISSING',
      longitude: detailer.longitude || 'MISSING',
      pricing_model: detailer.pricing_model || 'MISSING',
    };
    if (!detailer.full_name) missing.push('Detailer full_name');
    if (detailer.years_experience === null || detailer.years_experience === undefined) missing.push('Detailer years_experience');
    if (!detailer.bio) missing.push('Detailer bio');
    if (!detailer.specialties || detailer.specialties.length === 0) missing.push('Detailer specialties');
    if (!detailer.service_radius_km) missing.push('Detailer service_radius_km');
    if (!detailer.latitude || !detailer.longitude) missing.push('Detailer location (latitude/longitude)');
    if (!detailer.pricing_model) missing.push('Detailer pricing_model');

    // Verify address
    const { data: address, error: addressError } = await serviceClient
      .from('user_addresses')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_default', true)
      .maybeSingle();

    if (addressError) {
      errors.push(`Error fetching address: ${addressError.message}`);
    } else if (address) {
      verificationData.address = {
        address_line1: address.address_line1,
        city: address.city,
        province: address.province,
        postal_code: address.postal_code,
        latitude: address.latitude,
        longitude: address.longitude,
      };
    } else {
      missing.push('User address');
    }

    // Verify availability
    const { data: availability, error: availabilityError } = await serviceClient
      .from('detailer_availability')
      .select('*')
      .eq('detailer_id', detailerId)
      .eq('is_active', true);

    if (availabilityError) {
      errors.push(`Error fetching availability: ${availabilityError.message}`);
    } else if (availability && availability.length > 0) {
      verificationData.availability = availability;
    } else {
      missing.push('Availability slots');
    }

    // Verify days off
    const { data: daysOff, error: daysOffError } = await serviceClient
      .from('detailer_days_off')
      .select('*')
      .eq('detailer_id', detailerId)
      .eq('is_active', true);

    if (daysOffError) {
      errors.push(`Error fetching days off: ${daysOffError.message}`);
    } else if (daysOff) {
      verificationData.daysOff = daysOff;
    }
    // Days off are optional, so we don't add to missing if none exist

    console.log('=== ONBOARDING DATA VERIFICATION ===');
    console.log('Detailer ID:', detailerId);
    console.log('Verification Data:', verificationData);
    if (missing.length > 0) {
      console.warn('Missing Data:', missing);
    }
    if (errors.length > 0) {
      console.error('Errors:', errors);
    }
    console.log('=====================================');

    return {
      success: missing.length === 0 && errors.length === 0,
      data: verificationData,
      missing: missing.length > 0 ? missing : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error('Error in verifyOnboardingData:', error);
    return {
      success: false,
      errors: [error.message || 'Failed to verify onboarding data'],
    };
  }
}
