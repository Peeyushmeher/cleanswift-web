'use client';

import { useState } from 'react';
import Link from 'next/link';
import CalendarView from '../dashboard/CalendarView';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { formatDate } from '@/lib/detailer/dashboard-utils';

interface SchedulePageClientProps {
  bookings: any[];
  mode: 'solo' | 'organization';
  teams: Array<{ id: string; name: string }>;
  detailers: Array<{ profile_id: string; full_name: string }>;
  availabilitySlots: any[];
}

type ViewType = 'personal' | 'team' | 'organization';

export default function SchedulePageClient({
  bookings,
  mode,
  teams,
  detailers,
  availabilitySlots,
}: SchedulePageClientProps) {
  const [view, setView] = useState<ViewType>(mode === 'organization' ? 'organization' : 'personal');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedDetailer, setSelectedDetailer] = useState<string>('all');

  const filteredBookings = bookings.filter((b) => {
    if (view === 'team' && selectedTeam !== 'all') {
      return b.team_id === selectedTeam;
    }
    if (view === 'organization' && selectedDetailer !== 'all') {
      return b.detailer_id === selectedDetailer;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* View Switcher (Org Mode Only) */}
      {mode === 'organization' && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-white">View:</span>
            <button
              onClick={() => setView('personal')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'personal'
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:text-white'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setView('team')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'team'
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:text-white'
              }`}
            >
              Team
            </button>
            <button
              onClick={() => setView('organization')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'organization'
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:text-white'
              }`}
            >
              Organization
            </button>

            {view === 'team' && teams.length > 0 && (
              <FilterDropdown
                label="Team"
                options={[
                  { value: 'all', label: 'All Teams' },
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
                value={selectedTeam}
                onChange={setSelectedTeam}
              />
            )}

            {view === 'organization' && detailers.length > 0 && (
              <FilterDropdown
                label="Detailer"
                options={[
                  { value: 'all', label: 'All Detailers' },
                  ...detailers.map((d) => ({ value: d.profile_id, label: d.full_name })),
                ]}
                value={selectedDetailer}
                onChange={setSelectedDetailer}
              />
            )}
          </div>
        </div>
      )}

      {/* Calendar View */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            {view === 'personal' ? 'Personal Calendar' : view === 'team' ? 'Team Calendar' : 'Organization Calendar'}
          </h2>
          {view === 'personal' && (
            <Link
              href="/detailer/availability"
              className="text-sm text-[#32CE7A] hover:text-[#6FF0C4] font-medium"
            >
              Manage Availability →
            </Link>
          )}
        </div>
        <CalendarView bookings={filteredBookings} />
      </div>

      {/* Upcoming Bookings List */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          {view === 'personal' ? 'Upcoming Bookings' : 'All Bookings'}
        </h2>
        {filteredBookings.length === 0 ? (
          <p className="text-[#C6CFD9]">No bookings found</p>
        ) : (
          <div className="space-y-4">
            {filteredBookings.slice(0, 10).map((booking) => (
              <Link
                key={booking.id}
                href={`/detailer/bookings/${booking.id}`}
                className="block bg-[#050B12] border border-white/5 rounded-lg p-4 hover:border-[#6FF0C4]/20 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-white">
                      {booking.car?.make} {booking.car?.model} {booking.car?.year}
                    </div>
                    <div className="text-sm text-[#C6CFD9] mt-1">
                      {booking.service?.name} - {booking.user?.full_name}
                      {mode === 'organization' && booking.detailer && (
                        <span className="ml-2 text-[#32CE7A]">• {booking.detailer.full_name}</span>
                      )}
                      {mode === 'organization' && booking.team && (
                        <span className="ml-2 text-[#6FF0C4]">• {booking.team.name}</span>
                      )}
                    </div>
                    <div className="text-sm text-[#C6CFD9] mt-1">
                      {booking.scheduled_date && booking.scheduled_time_start
                        ? `${formatDate(booking.scheduled_date)} at ${booking.scheduled_time_start.substring(0, 5)}`
                        : booking.scheduled_start
                        ? formatDate(booking.scheduled_start, 'short')
                        : 'Date TBD'}
                    </div>
                    {booking.address_line1 && (
                      <div className="text-xs text-[#C6CFD9] mt-1">
                        {booking.address_line1}, {booking.city}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      ${booking.service?.price || booking.total_amount || 0}
                    </div>
                    <div className="text-xs text-[#C6CFD9] mt-1 capitalize">{booking.status}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

