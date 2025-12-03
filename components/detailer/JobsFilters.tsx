'use client';

import { useState, useEffect } from 'react';
import FilterDropdown from '@/components/ui/FilterDropdown';
import type { Booking } from '@/types/detailer';
import { filterBookingsByDateRange, sortBookings } from '@/lib/detailer/dashboard-utils';

interface JobsFiltersProps {
  bookings: Booking[];
  onFiltered: (filtered: Booking[]) => void;
  mode?: 'solo' | 'organization';
  teams?: Array<{ id: string; name: string }>;
  detailers?: Array<{ profile_id: string; full_name: string }>;
}

const dateRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Organization mode includes additional statuses for dispatchers
const orgStatusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unassigned', label: '🔴 Unassigned (Needs Assignment)' },
  { value: 'offered', label: '🟡 Offered (Awaiting Accept)' },
  { value: 'accepted', label: '🟢 Accepted' },
  { value: 'in_progress', label: '🔵 In Progress' },
  { value: 'completed', label: '✅ Completed' },
  { value: 'cancelled', label: '⚫ Cancelled' },
];

const sortOptions = [
  { value: 'time', label: 'Start Time' },
  { value: 'price', label: 'Price' },
  { value: 'assignment', label: 'Assignment Time' },
];

export default function JobsFilters({ 
  bookings, 
  onFiltered,
  mode = 'solo',
  teams = [],
  detailers = []
}: JobsFiltersProps) {
  const [dateRange, setDateRange] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('time');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDetailer, setSelectedDetailer] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');

  // Apply filters
  const applyFilters = () => {
    let filtered = [...bookings];

    // Date range filter
    if (dateRange !== 'all') {
      filtered = filterBookingsByDateRange(
        filtered,
        dateRange as 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'all'
      );
    }

    // Status filter
    if (status !== 'all') {
      filtered = filtered.filter(b => b.status === status);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.receipt_id.toLowerCase().includes(term) ||
        b.user?.full_name?.toLowerCase().includes(term) ||
        b.car?.license_plate?.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered = sortBookings(filtered, sortBy as 'time' | 'distance' | 'price' | 'rating' | 'assignment');

    onFiltered(filtered);
  };

  // Re-apply filters when any filter changes
  useEffect(() => {
    let filtered = [...bookings];

    // Date range filter
    if (dateRange !== 'all') {
      filtered = filterBookingsByDateRange(
        filtered,
        dateRange as 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'all'
      );
    }

    // Status filter
    if (status !== 'all') {
      if (status === 'unassigned') {
        // Unassigned = paid status with no detailer assigned
        filtered = filtered.filter(b => b.status === 'paid' && !b.detailer_id);
      } else {
        filtered = filtered.filter(b => b.status === status);
      }
    }

    // Detailer filter (org mode only)
    if (mode === 'organization' && selectedDetailer !== 'all') {
      if (selectedDetailer === 'unassigned') {
        filtered = filtered.filter(b => !b.detailer_id);
      } else {
        filtered = filtered.filter(b => b.detailer_id === selectedDetailer);
      }
    }

    // Team filter (org mode only)
    if (mode === 'organization' && selectedTeam !== 'all') {
      filtered = filtered.filter(b => b.team_id === selectedTeam);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.receipt_id.toLowerCase().includes(term) ||
        b.user?.full_name?.toLowerCase().includes(term) ||
        b.car?.license_plate?.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered = sortBookings(filtered, sortBy as 'time' | 'distance' | 'price' | 'rating' | 'assignment');

    onFiltered(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, status, sortBy, searchTerm, selectedDetailer, selectedTeam, bookings, mode]);

  const detailerOptions = [
    { value: 'all', label: 'All Detailers' },
    { value: 'unassigned', label: '🔴 Unassigned' },
    ...detailers.map(d => ({ value: d.profile_id, label: d.full_name })),
  ];

  const teamOptions = [
    { value: 'all', label: 'All Teams' },
    ...teams.map(t => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4 mb-6">
      <div className={`grid grid-cols-1 ${mode === 'organization' ? 'md:grid-cols-6' : 'md:grid-cols-4'} gap-4`}>
        {/* Search */}
        <div className={mode === 'organization' ? 'md:col-span-2' : 'md:col-span-2'}>
          <input
            type="text"
            placeholder="Search by booking ID, customer name, or license plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            data-form-type="other"
            suppressHydrationWarning
            className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
          />
        </div>

        {/* Date Range Filter */}
        <FilterDropdown
          label="Date Range"
          options={dateRangeOptions}
          value={dateRange}
          onChange={(value) => setDateRange(value)}
        />

        {/* Status Filter */}
        <FilterDropdown
          label="Status"
          options={mode === 'organization' ? orgStatusOptions : statusOptions}
          value={status}
          onChange={(value) => setStatus(value)}
        />

        {/* Detailer Filter (Org Mode Only) */}
        {mode === 'organization' && detailers.length > 0 && (
          <FilterDropdown
            label="Detailer"
            options={detailerOptions}
            value={selectedDetailer}
            onChange={(value) => setSelectedDetailer(value)}
          />
        )}

        {/* Team Filter (Org Mode Only) */}
        {mode === 'organization' && teams.length > 0 && (
          <FilterDropdown
            label="Team"
            options={teamOptions}
            value={selectedTeam}
            onChange={(value) => setSelectedTeam(value)}
          />
        )}

        {/* Sort By */}
        <FilterDropdown
          label="Sort By"
          options={sortOptions}
          value={sortBy}
          onChange={(value) => setSortBy(value)}
        />
      </div>
    </div>
  );
}

