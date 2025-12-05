'use client';

import { useMemo } from 'react';

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
  is_active?: boolean;
}

interface DayOff {
  date: string; // YYYY-MM-DD
  reason?: string | null;
}

interface Booking {
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end?: string | null;
  id: string;
}

interface AvailabilityCalendarProps {
  availability?: AvailabilitySlot[];
  daysOff?: DayOff[];
  bookings?: Booking[];
  weekStart?: Date; // Optional: start of week to display (defaults to current week)
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AvailabilityCalendar({
  availability = [],
  daysOff = [],
  bookings = [],
  weekStart,
}: AvailabilityCalendarProps) {
  // Calculate the start of the week (Sunday)
  const weekStartDate = useMemo(() => {
    if (weekStart) {
      const date = new Date(weekStart);
      const day = date.getDay();
      date.setDate(date.getDate() - day);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const today = new Date();
    const day = today.getDay();
    today.setDate(today.getDate() - day);
    today.setHours(0, 0, 0, 0);
    return today;
  }, [weekStart]);

  // Get dates for each day of the week
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [weekStartDate]);

  // Convert time string (HH:mm:ss) to minutes since midnight
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes to percentage of day (assuming 6 AM - 10 PM display)
  const minutesToPercent = (minutes: number): number => {
    const startMinutes = 6 * 60; // 6 AM
    const endMinutes = 22 * 60; // 10 PM
    const totalMinutes = endMinutes - startMinutes;
    const adjustedMinutes = minutes - startMinutes;
    return Math.max(0, Math.min(100, (adjustedMinutes / totalMinutes) * 100));
  };

  // Get availability slot for a day
  const getAvailabilityForDay = (dayOfWeek: number): AvailabilitySlot | undefined => {
    return availability.find((slot) => slot.day_of_week === dayOfWeek && slot.is_active !== false);
  };

  // Check if a date is a day off
  const isDayOff = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return daysOff.some((dayOff) => dayOff.date === dateStr);
  };

  // Get bookings for a specific date
  const getBookingsForDate = (date: Date): Booking[] => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter((booking) => booking.scheduled_date === dateStr);
  };

  // Format time for display
  const formatTime = (time: string): string => {
    return time.substring(0, 5);
  };

  return (
    <div className="w-full">
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, index) => {
          const dayOfWeek = date.getDay();
          const slot = getAvailabilityForDay(dayOfWeek);
          const isOff = isDayOff(date);
          const dayBookings = getBookingsForDate(date);
          const dateStr = date.toISOString().split('T')[0];

          return (
            <div
              key={index}
              className={`flex flex-col border rounded-lg p-2 min-h-[200px] ${
                isOff
                  ? 'bg-slate-800/30 border-red-500/30 opacity-60'
                  : 'bg-[#0A1A2F] border-white/5'
              }`}
            >
              {/* Day Header */}
              <div className="mb-2">
                <div className="text-xs text-[#C6CFD9] font-medium">{DAY_ABBREVIATIONS[dayOfWeek]}</div>
                <div className={`text-sm font-semibold ${isOff ? 'text-red-400 line-through' : 'text-white'}`}>
                  {date.getDate()}
                </div>
                {isOff && (
                  <div className="text-xs text-red-400 mt-1">
                    {daysOff.find((d) => d.date === dateStr)?.reason || 'Day Off'}
                  </div>
                )}
              </div>

              {/* Time Blocks */}
              <div className="flex-1 relative">
                {slot ? (
                  <div className="relative h-full">
                    {/* Availability Window */}
                    <div
                      className="absolute bg-cyan-500/20 border border-cyan-500/40 rounded"
                      style={{
                        top: `${minutesToPercent(timeToMinutes(slot.start_time))}%`,
                        height: `${minutesToPercent(timeToMinutes(slot.end_time)) - minutesToPercent(timeToMinutes(slot.start_time))}%`,
                        width: '100%',
                      }}
                    >
                      <div className="p-1 text-xs text-cyan-300">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </div>

                      {/* Lunch Break */}
                      {slot.lunch_start_time && slot.lunch_end_time && (
                        <div
                          className="absolute bg-red-500/30 border border-red-500/50 rounded"
                          style={{
                            top: `${minutesToPercent(timeToMinutes(slot.lunch_start_time)) - minutesToPercent(timeToMinutes(slot.start_time))}%`,
                            height: `${minutesToPercent(timeToMinutes(slot.lunch_end_time)) - minutesToPercent(timeToMinutes(slot.lunch_start_time))}%`,
                            width: '100%',
                          }}
                        >
                          <div className="p-1 text-xs text-red-300">
                            Lunch: {formatTime(slot.lunch_start_time)} - {formatTime(slot.lunch_end_time)}
                          </div>
                        </div>
                      )}

                      {/* Bookings */}
                      {dayBookings.map((booking) => {
                        const bookingStart = timeToMinutes(booking.scheduled_time_start);
                        const bookingEnd = booking.scheduled_time_end
                          ? timeToMinutes(booking.scheduled_time_end)
                          : bookingStart + 120; // Default 2 hours
                        const slotStart = timeToMinutes(slot.start_time);
                        const slotEnd = timeToMinutes(slot.end_time);

                        // Only show if booking is within availability window
                        if (bookingStart < slotStart || bookingEnd > slotEnd) return null;

                        return (
                          <div
                            key={booking.id}
                            className="absolute bg-[#32CE7A]/40 border border-[#32CE7A]/60 rounded"
                            style={{
                              top: `${((bookingStart - slotStart) / (slotEnd - slotStart)) * 100}%`,
                              height: `${((bookingEnd - bookingStart) / (slotEnd - slotStart)) * 100}%`,
                              width: '100%',
                            }}
                          >
                            <div className="p-1 text-xs text-[#32CE7A] font-medium">
                              {formatTime(booking.scheduled_time_start)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-[#C6CFD9] text-xs">
                    {isOff ? 'Day Off' : 'Not Available'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-cyan-500/20 border border-cyan-500/40 rounded"></div>
          <span className="text-[#C6CFD9]">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500/30 border border-red-500/50 rounded"></div>
          <span className="text-[#C6CFD9]">Lunch Break</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#32CE7A]/40 border border-[#32CE7A]/60 rounded"></div>
          <span className="text-[#C6CFD9]">Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-800/30 border border-red-500/30 rounded opacity-60"></div>
          <span className="text-[#C6CFD9]">Day Off</span>
        </div>
      </div>
    </div>
  );
}

