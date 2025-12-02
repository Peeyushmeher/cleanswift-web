'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import JobsTable from '@/components/detailer/JobsTable';
import JobsFilters from '@/components/detailer/JobsFilters';
import JobAssignmentModal from '@/components/detailer/JobAssignmentModal';
import type { Booking } from '@/types/detailer';

interface JobsPageClientProps {
  initialBookings: Booking[];
  mode?: 'solo' | 'organization';
  teams?: Array<{ id: string; name: string }>;
  detailers?: Array<{ profile_id: string; full_name: string }>;
  organizationId?: string;
}

export default function JobsPageClient({ 
  initialBookings, 
  mode = 'solo',
  teams = [],
  detailers = [],
  organizationId
}: JobsPageClientProps) {
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>(initialBookings);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [selectedCurrentDetailerId, setSelectedCurrentDetailerId] = useState<string | null>(null);
  const router = useRouter();

  const handleAssignClick = (bookingId: string, currentDetailerId?: string | null) => {
    setSelectedBookingId(bookingId);
    setSelectedCurrentDetailerId(currentDetailerId || null);
    setAssignmentModalOpen(true);
  };

  const handleAssigned = () => {
    router.refresh();
  };

  return (
    <>
      <JobsFilters 
        bookings={initialBookings} 
        onFiltered={setFilteredBookings}
        mode={mode}
        teams={teams}
        detailers={detailers}
      />
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <JobsTable 
          bookings={filteredBookings} 
          showOrgColumns={mode === 'organization'}
          onAssignClick={mode === 'organization' && organizationId ? handleAssignClick : undefined}
        />
      </div>

      {mode === 'organization' && organizationId && (
        <JobAssignmentModal
          isOpen={assignmentModalOpen}
          onClose={() => setAssignmentModalOpen(false)}
          bookingId={selectedBookingId}
          organizationId={organizationId}
          currentDetailerId={selectedCurrentDetailerId}
          onAssigned={handleAssigned}
        />
      )}
    </>
  );
}

