'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
  is_active: boolean;
}

interface DayOff {
  id: string;
  date: string;
  reason?: string | null;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  role: 'user' | 'detailer' | 'admin';
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Permission-related error messages from the RPC function
const PERMISSION_ERRORS = [
  'Only detailers and admins can view availability',
  'Only detailers can set availability',
  'Not authenticated',
  'User profile not found',
  'Detailer profile not found',
];

export default function AvailabilityPage() {
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasDetailerRecord, setHasDetailerRecord] = useState(true);
  const [newDayOffDate, setNewDayOffDate] = useState('');
  const [newDayOffReason, setNewDayOffReason] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // Check if error is permission-related
  const isPermissionError = (errorMessage: string): boolean => {
    return PERMISSION_ERRORS.some(permError => 
      errorMessage.toLowerCase().includes(permError.toLowerCase())
    );
  };

  // Verify user authentication and role
  const verifyUser = useCallback(async (): Promise<UserProfile | null> => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      router.push('/auth/login');
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      router.push('/auth/login');
      return null;
    }

    // Check if user has permission to access this page
    if (profile.role !== 'detailer' && profile.role !== 'admin') {
      router.push('/auth/login');
      return null;
    }

    setIsAdmin(profile.role === 'admin');
    return profile as UserProfile;
  }, [supabase, router]);

  // Check if detailer record exists for this user
  const checkDetailerRecord = useCallback(async (profileId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('detailers')
      .select('id')
      .eq('profile_id', profileId)
      .single();

    return !!data;
  }, [supabase]);

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First verify the user
      const profile = await verifyUser();
      if (!profile) return;

      // Check if detailer record exists
      const hasRecord = await checkDetailerRecord(profile.id);
      setHasDetailerRecord(hasRecord);

      // If detailer role but no record found, show error
      if (profile.role === 'detailer' && !hasRecord) {
        setError('Detailer profile not found. Please complete onboarding or contact support.');
        setLoading(false);
        return;
      }

      // If admin without detailer record, show empty state (not an error)
      if (profile.role === 'admin' && !hasRecord) {
        setAvailability([]);
        setDaysOff([]);
        setLoading(false);
        return;
      }

      // For detailers, get the detailer ID first
      let detailerId: string | null = null;
      if (profile.role === 'detailer' && hasRecord) {
        const { data: detailerData, error: detailerError } = await supabase
          .from('detailers')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();

        if (detailerError || !detailerData) {
          setError('Failed to load detailer information. Please try again.');
          setLoading(false);
          return;
        }

        detailerId = detailerData.id;
      }

      // Fetch availability - use the detailer_id we already fetched for detailers
      // The RPC will verify it belongs to the current user, which it does
      const { data: availabilityData, error: fetchError } = await supabase.rpc('get_detailer_availability', 
        detailerId ? { p_detailer_id: detailerId } : {}
      );

      if (fetchError) {
        console.error('Error fetching availability via RPC:', {
          message: fetchError.message,
          code: fetchError.code,
          details: fetchError.details,
          hint: fetchError.hint,
          detailerId: detailerId,
        });
        
        // If RPC fails and we have a detailer ID, try direct query as fallback
        if (detailerId) {
          console.log('RPC failed, trying direct query as fallback...');
          const { data: directData, error: directError } = await supabase
            .from('detailer_availability')
            .select('*')
            .eq('detailer_id', detailerId)
            .order('day_of_week', { ascending: true });

          if (directError) {
            console.error('Direct query also failed:', {
              message: directError.message,
              code: directError.code,
              details: directError.details,
              hint: directError.hint,
            });
            setError(fetchError.message || directError.message || 'Failed to load availability. Please try again.');
            setLoading(false);
            return;
          }

          setAvailability(Array.isArray(directData) ? directData : []);
        } else {
          // No detailer ID, show error
          setError(fetchError.message || 'Failed to load availability. Please try again.');
          setLoading(false);
          return;
        }
      } else {
        // RPC succeeded
        const availabilityArray = Array.isArray(availabilityData) ? availabilityData : (availabilityData ? [availabilityData] : []);
        setAvailability(availabilityArray);
      }

      // Fetch days off - use the detailer_id we already fetched
      // The RPC will verify it belongs to the current user, which it does
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 10);
      
      // Only call RPC if we have a detailer ID (for detailers) or if admin
      if (profile.role === 'detailer' && detailerId) {
        const { data: daysOffData, error: daysOffError } = await supabase.rpc('get_detailer_days_off', {
          p_detailer_id: detailerId, // Pass the detailer_id we already verified
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0],
        });

        if (daysOffError) {
          console.error('Error fetching days off via RPC:', {
            message: daysOffError.message,
            code: daysOffError.code,
            details: daysOffError.details,
            hint: daysOffError.hint,
            detailerId: detailerId,
          });
          
          // If RPC fails, try direct query as fallback
          console.log('RPC failed for days off, trying direct query as fallback...');
          const { data: directDaysOffData, error: directDaysOffError } = await supabase
            .from('detailer_days_off')
            .select('*')
            .eq('detailer_id', detailerId)
            .eq('is_active', true)
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

          if (directDaysOffError) {
            console.error('Direct query for days off also failed:', {
              message: directDaysOffError.message,
              code: directDaysOffError.code,
              details: directDaysOffError.details,
              hint: directDaysOffError.hint,
            });
          } else {
            setDaysOff(Array.isArray(directDaysOffData) ? directDaysOffData : []);
          }
          // If direct query also fails, continue without days off (don't fail the whole operation)
        } else {
          const daysOffArray = Array.isArray(daysOffData) ? daysOffData : (daysOffData ? [daysOffData] : []);
          setDaysOff(daysOffArray);
        }
      } else if (profile.role === 'admin') {
        // For admins, call RPC without detailer_id
        const { data: daysOffData, error: daysOffError } = await supabase.rpc('get_detailer_days_off', {
          p_detailer_id: null,
          p_start_date: startDate.toISOString().split('T')[0],
          p_end_date: endDate.toISOString().split('T')[0],
        });

        if (!daysOffError && daysOffData) {
          const daysOffArray = Array.isArray(daysOffData) ? daysOffData : (daysOffData ? [daysOffData] : []);
          setDaysOff(daysOffArray);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load availability';
      console.error('Error in fetchAvailability:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, verifyUser, checkDetailerRecord]);

  // Load availability on mount
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const handleToggleDay = async (dayOfWeek: number) => {
    try {
      setSaving(true);
      setError(null);

      // Verify session is valid before calling RPC
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.user) {
        console.error('Session error:', sessionError, 'Session:', session);
        setError('You must be logged in to update availability. Please refresh the page.');
        return;
      }

      console.log('Session verified:', { 
        userId: session.user.id, 
        expiresAt: session.expires_at,
        accessToken: session.access_token ? 'present' : 'missing'
      });

      // Verify user's role is detailer
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Profile query error:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
        });
        setError('Failed to verify your account. Please refresh the page.');
        return;
      }

      if (!profile || profile.role !== 'detailer') {
        console.error('User role check failed:', { 
          userId: session.user.id, 
          role: profile?.role,
          hasProfile: !!profile 
        });
        setError('Only detailers can update availability. Please contact support if you believe this is an error.');
        return;
      }

      console.log('User verified for availability update:', { userId: session.user.id, role: profile.role });

      const existingSlot = availability.find((slot) => slot.day_of_week === dayOfWeek);

      if (existingSlot) {
        // Toggle existing slot
        const { error: updateError } = await supabase.rpc('set_detailer_availability', {
          p_day_of_week: dayOfWeek,
          p_start_time: existingSlot.start_time,
          p_end_time: existingSlot.end_time,
          p_is_active: !existingSlot.is_active,
          p_lunch_start_time: existingSlot.lunch_start_time || null,
          p_lunch_end_time: existingSlot.lunch_end_time || null,
        });

        if (updateError) {
          console.error('Error updating availability:', updateError);
          console.error('Error details:', {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
            error: updateError,
            stringified: JSON.stringify(updateError),
          });
          setError(updateError.message || 'Failed to update availability. Please try again.');
          return;
        }
      } else {
        // Create new slot with default hours (9 AM - 5 PM)
        const { error: createError } = await supabase.rpc('set_detailer_availability', {
          p_day_of_week: dayOfWeek,
          p_start_time: '09:00:00',
          p_end_time: '17:00:00',
          p_is_active: true,
        });

        if (createError) {
          console.error('Error creating availability:', createError);
          console.error('Error details:', {
            message: createError.message,
            code: createError.code,
            details: createError.details,
            hint: createError.hint,
            error: createError,
            stringified: JSON.stringify(createError),
          });
          setError(createError.message || 'Failed to create availability. Please try again.');
          return;
        }
      }

      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update availability';
      console.error('Error in handleToggleDay:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (dayOfWeek: number, field: 'start_time' | 'end_time' | 'lunch_start_time' | 'lunch_end_time', value: string) => {
    try {
      setSaving(true);
      setError(null);

      // Verify session is valid before calling RPC
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.user) {
        console.error('Session error:', sessionError, 'Session:', session);
        setError('You must be logged in to update availability. Please refresh the page.');
        return;
      }

      console.log('Session verified for time update:', { 
        userId: session.user.id, 
        expiresAt: session.expires_at,
        accessToken: session.access_token ? 'present' : 'missing'
      });

      // Verify user's role is detailer
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Profile query error:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
        });
        setError('Failed to verify your account. Please refresh the page.');
        return;
      }

      if (!profile || profile.role !== 'detailer') {
        console.error('User role check failed:', { 
          userId: session.user.id, 
          role: profile?.role,
          hasProfile: !!profile 
        });
        setError('Only detailers can update availability. Please contact support if you believe this is an error.');
        return;
      }

      console.log('User verified for time update:', { userId: session.user.id, role: profile.role });

      const existingSlot = availability.find((slot) => slot.day_of_week === dayOfWeek);
      const timeValue = value.includes(':') && value.split(':').length === 2 ? `${value}:00` : value;

      const { error: updateError } = await supabase.rpc('set_detailer_availability', {
        p_day_of_week: dayOfWeek,
        p_start_time: field === 'start_time' ? timeValue : existingSlot?.start_time || '09:00:00',
        p_end_time: field === 'end_time' ? timeValue : existingSlot?.end_time || '17:00:00',
        p_is_active: existingSlot?.is_active ?? true,
        p_lunch_start_time: field === 'lunch_start_time' ? timeValue : (field === 'lunch_end_time' ? existingSlot?.lunch_start_time : existingSlot?.lunch_start_time) || null,
        p_lunch_end_time: field === 'lunch_end_time' ? timeValue : (field === 'lunch_start_time' ? existingSlot?.lunch_end_time : existingSlot?.lunch_end_time) || null,
      });

      if (updateError) {
        console.error('Error updating time:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        });
        setError(updateError.message || 'Failed to update time. Please try again.');
        return;
      }
      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update time';
      console.error('Error in handleTimeChange:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleLunchBreakToggle = async (dayOfWeek: number) => {
    try {
      setSaving(true);
      setError(null);

      // Verify session is valid before calling RPC
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.user) {
        console.error('Session error:', sessionError, 'Session:', session);
        setError('You must be logged in to update availability. Please refresh the page.');
        return;
      }

      console.log('Session verified for lunch break update:', { 
        userId: session.user.id, 
        expiresAt: session.expires_at,
        accessToken: session.access_token ? 'present' : 'missing'
      });

      // Verify user's role is detailer
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Profile query error:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
        });
        setError('Failed to verify your account. Please refresh the page.');
        return;
      }

      if (!profile || profile.role !== 'detailer') {
        console.error('User role check failed:', { 
          userId: session.user.id, 
          role: profile?.role,
          hasProfile: !!profile 
        });
        setError('Only detailers can update availability. Please contact support if you believe this is an error.');
        return;
      }

      console.log('User verified for lunch break update:', { userId: session.user.id, role: profile.role });

      const existingSlot = availability.find((slot) => slot.day_of_week === dayOfWeek);
      if (!existingSlot) return;

      const hasLunchBreak = existingSlot.lunch_start_time && existingSlot.lunch_end_time;

      const { error: updateError } = await supabase.rpc('set_detailer_availability', {
        p_day_of_week: dayOfWeek,
        p_start_time: existingSlot.start_time,
        p_end_time: existingSlot.end_time,
        p_is_active: existingSlot.is_active,
        p_lunch_start_time: hasLunchBreak ? null : '12:00:00',
        p_lunch_end_time: hasLunchBreak ? null : '13:00:00',
      });

      if (updateError) {
        console.error('Error updating lunch break:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        });
        setError(updateError.message || 'Failed to update lunch break. Please try again.');
        return;
      }
      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update lunch break';
      console.error('Error in handleLunchBreakToggle:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDayOff = async () => {
    if (!newDayOffDate) return;

    try {
      setSaving(true);
      setError(null);

      const { error: addError } = await supabase.rpc('add_detailer_day_off', {
        p_date: newDayOffDate,
        p_reason: newDayOffReason || null,
      });

      if (addError) {
        setError(addError.message || 'Failed to add day off. Please try again.');
        return;
      }

      setNewDayOffDate('');
      setNewDayOffReason('');
      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add day off';
      console.error('Error in handleAddDayOff:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDayOff = async (date: string) => {
    try {
      setSaving(true);
      setError(null);

      const { error: removeError } = await supabase.rpc('remove_detailer_day_off', {
        p_date: date,
      });

      if (removeError) {
        setError(removeError.message || 'Failed to remove day off. Please try again.');
        return;
      }

      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove day off';
      console.error('Error in handleRemoveDayOff:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const getSlotForDay = (dayOfWeek: number) => {
    return availability.find((slot) => slot.day_of_week === dayOfWeek);
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // HH:mm
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050B12] text-white flex items-center justify-center">
        <div className="text-[#C6CFD9]">Loading availability...</div>
      </div>
    );
  }

  // Admin without detailer record - show informative message
  if (isAdmin && !hasDetailerRecord) {
    return (
      <div className="min-h-screen bg-[#050B12] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Availability Management</h1>
            <p className="text-[#C6CFD9]">Set your weekly availability schedule</p>
          </div>

          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
            <div className="text-center py-8">
              <div className="text-[#C6CFD9] mb-4">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Admin Account</h3>
              <p className="text-[#C6CFD9] text-sm max-w-md mx-auto">
                As an admin, you don&apos;t have personal availability to manage. 
                To manage a detailer&apos;s availability, please access their profile directly.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Availability Management</h1>
          <p className="text-[#C6CFD9]">Set your weekly availability schedule</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="space-y-4">
            {DAY_NAMES.map((dayName, index) => {
              const slot = getSlotForDay(index);
              const isActive = slot?.is_active ?? false;

              return (
                <div
                  key={index}
                  className="p-4 bg-[#050B12] border border-white/5 rounded-lg"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => handleToggleDay(index)}
                          disabled={saving}
                          className="w-5 h-5 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A]"
                        />
                        <span className="text-white font-medium w-24">{dayName}</span>
                      </label>

                      {isActive && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="time"
                            value={slot ? formatTime(slot.start_time) : '09:00'}
                            onChange={(e) => handleTimeChange(index, 'start_time', e.target.value)}
                            disabled={saving}
                            className="px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6FF0C4]"
                          />
                          <span className="text-[#C6CFD9]">to</span>
                          <input
                            type="time"
                            value={slot ? formatTime(slot.end_time) : '17:00'}
                            onChange={(e) => handleTimeChange(index, 'end_time', e.target.value)}
                            disabled={saving}
                            className="px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6FF0C4]"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Lunch Break Section - Always on its own line when active */}
                    {isActive && (
                      <div className="flex items-center gap-2 pl-8">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!(slot?.lunch_start_time && slot?.lunch_end_time)}
                            onChange={() => handleLunchBreakToggle(index)}
                            disabled={saving}
                            className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A]"
                          />
                          <span className="text-[#C6CFD9] text-xs">Lunch</span>
                        </label>
                        
                        {slot?.lunch_start_time && slot?.lunch_end_time && (
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={formatTime(slot.lunch_start_time)}
                              onChange={(e) => handleTimeChange(index, 'lunch_start_time', e.target.value)}
                              disabled={saving}
                              className="px-2 py-1 bg-[#0A1A2F] border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#6FF0C4]"
                            />
                            <span className="text-[#C6CFD9] text-xs">-</span>
                            <input
                              type="time"
                              value={formatTime(slot.lunch_end_time)}
                              onChange={(e) => handleTimeChange(index, 'lunch_end_time', e.target.value)}
                              disabled={saving}
                              className="px-2 py-1 bg-[#0A1A2F] border border-white/10 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#6FF0C4]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {saving && (
            <div className="mt-4 text-[#C6CFD9] text-sm">Saving changes...</div>
          )}
        </div>

        {/* Days Off Section */}
        <div className="mt-8 bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Days Off</h2>
              <p className="text-[#C6CFD9] text-sm">Mark specific dates as unavailable (holidays, vacations, etc.)</p>
            </div>
          </div>

          {/* Add Day Off Form */}
          <div className="mb-6 p-4 bg-[#050B12] border border-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={newDayOffDate}
                onChange={(e) => setNewDayOffDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={saving}
                className="px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6FF0C4]"
                placeholder="Select date"
              />
              <input
                type="text"
                value={newDayOffReason}
                onChange={(e) => setNewDayOffReason(e.target.value)}
                disabled={saving}
                className="flex-1 px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6FF0C4]"
                placeholder="Reason (optional)"
              />
              <button
                onClick={handleAddDayOff}
                disabled={saving || !newDayOffDate}
                className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Days Off List */}
          {daysOff.length === 0 ? (
            <p className="text-[#C6CFD9] text-sm italic">No days off added</p>
          ) : (
            <div className="space-y-2">
              {daysOff.map((dayOff) => (
                <div
                  key={dayOff.id}
                  className="flex items-center justify-between p-3 bg-[#050B12] border border-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-white font-medium">
                      {new Date(dayOff.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    {dayOff.reason && (
                      <span className="text-[#C6CFD9] text-sm">({dayOff.reason})</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveDayOff(dayOff.date)}
                    disabled={saving}
                    className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

