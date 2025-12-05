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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      router.push('/auth/login');
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
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

      // If admin without detailer record, show empty state (not an error)
      if (profile.role === 'admin' && !hasRecord) {
        setAvailability([]);
        setLoading(false);
        return;
      }

      // Fetch availability
      const { data, error: fetchError } = await supabase.rpc('get_detailer_availability');

      if (fetchError) {
        // Handle permission errors by redirecting
        if (isPermissionError(fetchError.message)) {
          router.push('/auth/login');
          return;
        }
        throw fetchError;
      }
      
      setAvailability(data || []);

      // Fetch days off
      const { data: daysOffData, error: daysOffError } = await supabase.rpc('get_detailer_days_off');

      if (daysOffError) {
        // Handle permission errors by redirecting
        if (isPermissionError(daysOffError.message)) {
          router.push('/auth/login');
          return;
        }
        console.error('Error fetching days off:', daysOffError);
        // Don't fail the whole operation
      } else {
        setDaysOff(daysOffData || []);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load availability';
      
      // Check for permission errors and redirect
      if (isPermissionError(errorMessage)) {
        router.push('/auth/login');
        return;
      }
      
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

      const existingSlot = availability.find((slot) => slot.day_of_week === dayOfWeek);

      if (existingSlot) {
        // Toggle existing slot
        const { error: updateError } = await supabase.rpc('set_detailer_availability', {
          p_day_of_week: dayOfWeek,
          p_start_time: existingSlot.start_time,
          p_end_time: existingSlot.end_time,
          p_is_active: !existingSlot.is_active,
        });

        if (updateError) {
          if (isPermissionError(updateError.message)) {
            router.push('/auth/login');
            return;
          }
          throw updateError;
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
          if (isPermissionError(createError.message)) {
            router.push('/auth/login');
            return;
          }
          throw createError;
        }
      }

      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update availability';
      if (isPermissionError(errorMessage)) {
        router.push('/auth/login');
        return;
      }
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (dayOfWeek: number, field: 'start_time' | 'end_time' | 'lunch_start_time' | 'lunch_end_time', value: string) => {
    try {
      setSaving(true);
      setError(null);

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
        if (isPermissionError(updateError.message)) {
          router.push('/auth/login');
          return;
        }
        throw updateError;
      }
      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update time';
      if (isPermissionError(errorMessage)) {
        router.push('/auth/login');
        return;
      }
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleLunchBreakToggle = async (dayOfWeek: number) => {
    try {
      setSaving(true);
      setError(null);

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
        if (isPermissionError(updateError.message)) {
          router.push('/auth/login');
          return;
        }
        throw updateError;
      }
      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update lunch break';
      if (isPermissionError(errorMessage)) {
        router.push('/auth/login');
        return;
      }
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
        if (isPermissionError(addError.message)) {
          router.push('/auth/login');
          return;
        }
        throw addError;
      }

      setNewDayOffDate('');
      setNewDayOffReason('');
      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add day off';
      if (isPermissionError(errorMessage)) {
        router.push('/auth/login');
        return;
      }
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
        if (isPermissionError(removeError.message)) {
          router.push('/auth/login');
          return;
        }
        throw removeError;
      }

      await fetchAvailability();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove day off';
      if (isPermissionError(errorMessage)) {
        router.push('/auth/login');
        return;
      }
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

