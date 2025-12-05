'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import AvailabilityCalendar from '@/components/detailer/AvailabilityCalendar';

interface Detailer {
  id: string;
  full_name: string;
}

interface DetailerAvailabilityViewerProps {
  detailers: Detailer[];
}

export default function DetailerAvailabilityViewer({ detailers }: DetailerAvailabilityViewerProps) {
  const [selectedDetailerId, setSelectedDetailerId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [daysOff, setDaysOff] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!selectedDetailerId) {
      setAvailability([]);
      setDaysOff([]);
      setBookings([]);
      return;
    }

    const loadDetailerData = async () => {
      setLoading(true);
      try {
        // Load availability
        const { data: availabilityData } = await supabase.rpc('get_detailer_availability', {
          p_detailer_id: selectedDetailerId,
        });
        setAvailability(availabilityData || []);

        // Load days off
        const { data: daysOffData } = await supabase.rpc('get_detailer_days_off', {
          p_detailer_id: selectedDetailerId,
        });
        setDaysOff(daysOffData || []);

        // Load bookings for the current week
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('id, scheduled_date, scheduled_time_start, scheduled_time_end')
          .eq('detailer_id', selectedDetailerId)
          .gte('scheduled_date', weekStart.toISOString().split('T')[0])
          .lt('scheduled_date', weekEnd.toISOString().split('T')[0])
          .in('status', ['accepted', 'in_progress', 'scheduled', 'paid']);

        setBookings(bookingsData || []);
      } catch (error) {
        console.error('Error loading detailer data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDetailerData();
  }, [selectedDetailerId, supabase]);

  if (detailers.length === 0) {
    return (
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <p className="text-[#C6CFD9]">No detailers available</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Detailer Availability</h2>
      
      {/* Detailer Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
          Select Detailer
        </label>
        <select
          value={selectedDetailerId || ''}
          onChange={(e) => setSelectedDetailerId(e.target.value || null)}
          className="w-full px-4 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
        >
          <option value="">-- Select a detailer --</option>
          {detailers.map((detailer) => (
            <option key={detailer.id} value={detailer.id}>
              {detailer.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="text-center py-8 text-[#C6CFD9]">Loading...</div>
      ) : selectedDetailerId ? (
        <AvailabilityCalendar
          availability={availability}
          daysOff={daysOff}
          bookings={bookings}
        />
      ) : (
        <div className="text-center py-8 text-[#C6CFD9]">
          Select a detailer to view their availability
        </div>
      )}
    </div>
  );
}

