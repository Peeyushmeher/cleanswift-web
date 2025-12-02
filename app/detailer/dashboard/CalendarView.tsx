'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface Booking {
  id: string;
  receipt_id: string;
  status: string;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end?: string | null;
  scheduled_start?: string;
  service?: {
    name: string;
    price: number;
  };
  car?: {
    make: string;
    model: string;
    year: string;
  };
  user?: {
    full_name: string;
  };
}

interface CalendarViewProps {
  bookings: Booking[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function CalendarView({ bookings }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, Booking[]> = {};
    bookings.forEach((booking) => {
      const dateKey = booking.scheduled_date || 
        (booking.scheduled_start ? new Date(booking.scheduled_start).toISOString().split('T')[0] : '');
      if (dateKey) {
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(booking);
      }
    });
    return grouped;
  }, [bookings]);

  // Get bookings for a specific date
  const getBookingsForDate = (day: number): Booking[] => {
    const date = new Date(currentYear, currentMonth, day);
    const dateKey = date.toISOString().split('T')[0];
    return bookingsByDate[dateKey] || [];
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'accepted':
        return 'bg-[#1DA4F3]/20 border-[#1DA4F3]/40 text-[#1DA4F3]';
      case 'in_progress':
        return 'bg-[#6FF0C4]/20 border-[#6FF0C4]/40 text-[#6FF0C4]';
      case 'completed':
        return 'bg-[#32CE7A]/20 border-[#32CE7A]/40 text-[#32CE7A]';
      default:
        return 'bg-[#C6CFD9]/20 border-[#C6CFD9]/40 text-[#C6CFD9]';
    }
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Array<{ day: number; isCurrentMonth: boolean; isToday: boolean }> = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ day: 0, isCurrentMonth: false, isToday: false });
    }

    // Add days of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday =
        day === today.getDate() &&
        currentMonth === today.getMonth() &&
        currentYear === today.getFullYear();
      days.push({ day, isCurrentMonth: true, isToday });
    }

    // Fill remaining cells to complete 6 weeks (42 cells total)
    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    for (let i = 0; i < remainingCells; i++) {
      days.push({ day: 0, isCurrentMonth: false, isToday: false });
    }

    return days;
  }, [firstDayOfMonth, daysInMonth, currentMonth, currentYear]);

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg
              className="w-5 h-5 text-[#C6CFD9]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h3 className="text-xl font-semibold text-white">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h3>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <svg
              className="w-5 h-5 text-[#C6CFD9]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-4 py-2 bg-[#1DA4F3]/20 hover:bg-[#1DA4F3]/30 border border-[#1DA4F3]/40 text-[#1DA4F3] rounded-lg transition-colors text-sm font-medium"
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-[#C6CFD9] py-2"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map(({ day, isCurrentMonth, isToday }, index) => {
          const bookingsForDay = day > 0 ? getBookingsForDate(day) : [];
          const hasBookings = bookingsForDay.length > 0;

          return (
            <div
              key={index}
              className={`min-h-[100px] p-2 border border-white/5 rounded-lg ${
                isCurrentMonth ? 'bg-[#050B12]' : 'bg-[#0A1A2F]/50 opacity-50'
              } ${isToday ? 'ring-2 ring-[#6FF0C4]/50' : ''}`}
            >
              {day > 0 && (
                <>
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isToday
                        ? 'text-[#6FF0C4]'
                        : isCurrentMonth
                        ? 'text-white'
                        : 'text-[#C6CFD9]'
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-1">
                    {bookingsForDay.slice(0, 2).map((booking) => (
                      <Link
                        key={booking.id}
                        href={`/detailer/bookings/${booking.id}`}
                        className={`block text-xs p-1.5 rounded border ${getStatusColor(
                          booking.status
                        )} hover:opacity-80 transition-opacity truncate`}
                        title={`${booking.service?.name || 'Service'} - ${booking.user?.full_name || 'Customer'} at ${booking.scheduled_time_start?.substring(0, 5) || ''}`}
                      >
                        <div className="font-medium truncate">
                          {booking.scheduled_time_start?.substring(0, 5) || ''}
                        </div>
                        <div className="truncate">
                          {booking.service?.name || 'Service'}
                        </div>
                      </Link>
                    ))}
                    {bookingsForDay.length > 2 && (
                      <div className="text-xs text-[#C6CFD9] px-1.5 py-1">
                        +{bookingsForDay.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#1DA4F3]/20 border border-[#1DA4F3]/40"></div>
          <span className="text-[#C6CFD9]">Accepted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#6FF0C4]/20 border border-[#6FF0C4]/40"></div>
          <span className="text-[#C6CFD9]">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#32CE7A]/20 border border-[#32CE7A]/40"></div>
          <span className="text-[#C6CFD9]">Completed</span>
        </div>
      </div>
    </div>
  );
}

