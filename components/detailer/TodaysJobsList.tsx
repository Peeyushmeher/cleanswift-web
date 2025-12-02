import Link from 'next/link';
import { formatDateTime } from '@/lib/detailer/dashboard-utils';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Booking } from '@/types/detailer';

interface TodaysJobsListProps {
  bookings: Booking[];
}

export default function TodaysJobsList({ bookings }: TodaysJobsListProps) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-8 text-[#C6CFD9]">
        No jobs scheduled for today
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.slice(0, 10).map((booking) => (
        <Link
          key={booking.id}
          href={`/detailer/bookings/${booking.id}`}
          className="block bg-[#050B12] border border-white/5 rounded-lg p-4 hover:border-[#6FF0C4]/20 transition-colors"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-semibold text-white mb-1">
                {booking.car?.make} {booking.car?.model} {booking.car?.year}
              </div>
              <div className="text-sm text-[#C6CFD9] mb-2">
                {booking.service?.name} - {booking.user?.full_name}
              </div>
              <div className="text-sm text-[#C6CFD9]">
                {booking.scheduled_date && booking.scheduled_time_start
                  ? formatDateTime(booking.scheduled_date, booking.scheduled_time_start)
                  : booking.scheduled_start
                  ? new Date(booking.scheduled_start).toLocaleString()
                  : 'Time TBD'}
              </div>
              {booking.address_line1 && (
                <div className="text-xs text-[#C6CFD9] mt-1">
                  {booking.address_line1}, {booking.city}
                </div>
              )}
            </div>
            <div className="text-right ml-4">
              <div className="text-white font-semibold mb-2">
                ${booking.service?.price || booking.total_amount || 0}
              </div>
              <StatusBadge status={booking.status} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

