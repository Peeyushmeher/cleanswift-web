'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDate, formatCurrency, getPaymentStatusColor } from '@/lib/detailer/dashboard-utils';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { Booking } from '@/types/detailer';

interface JobsTableProps {
  bookings: Booking[];
  loading?: boolean;
  pageSize?: number;
  showOrgColumns?: boolean; // Show detailer and team columns for org mode
  onAssignClick?: (bookingId: string, currentDetailerId?: string | null) => void;
}

export default function JobsTable({ bookings, loading = false, pageSize = 10, showOrgColumns = false, onAssignClick }: JobsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(bookings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookings = bookings.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 text-[#C6CFD9]">
        No jobs found
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Booking ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Car
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Service
              </th>
              {showOrgColumns && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                    Assigned Detailer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                    Team
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Payment
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                Amount
              </th>
              {showOrgColumns && onAssignClick && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedBookings.map((booking) => (
              <tr
                key={booking.id}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/detailer/bookings/${booking.id}`}
                    className="text-sm text-[#32CE7A] hover:text-[#6FF0C4] font-mono"
                  >
                    {booking.receipt_id}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                  {booking.scheduled_date && booking.scheduled_time_start
                    ? `${formatDate(booking.scheduled_date)} ${booking.scheduled_time_start.substring(0, 5)}`
                    : booking.scheduled_start
                    ? formatDate(booking.scheduled_start, 'short')
                    : 'TBD'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                  {booking.user?.full_name || 'N/A'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                  <div>
                    <div>{booking.car?.make} {booking.car?.model}</div>
                    <div className="text-xs text-[#C6CFD9]">{booking.car?.license_plate}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  <div>
                    <div>{booking.address_line1}</div>
                    <div className="text-xs text-[#C6CFD9]">{booking.city}, {booking.province}</div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                  {booking.service?.name || 'N/A'}
                </td>
                {showOrgColumns && (
                  <>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                      {booking.detailer?.full_name || (
                        <span className="text-[#C6CFD9] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                      {booking.team?.name || '-'}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-sm ${getPaymentStatusColor(booking.payment_status)}`}>
                    {booking.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-white">
                  {formatCurrency(booking.total_amount || booking.service_price || 0)}
                </td>
                {showOrgColumns && onAssignClick && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!booking.detailer_id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignClick(booking.id, booking.detailer_id);
                        }}
                        className="px-3 py-1 bg-[#32CE7A] hover:bg-[#2AB869] text-white text-xs font-semibold rounded transition-colors"
                      >
                        Assign
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignClick(booking.id, booking.detailer_id);
                        }}
                        className="px-3 py-1 bg-[#0A1A2F] border border-white/5 hover:border-[#32CE7A]/40 text-white text-xs font-semibold rounded transition-colors"
                      >
                        Reassign
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-[#C6CFD9]">
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, bookings.length)} of {bookings.length} jobs
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[#0A1A2F] border border-white/5 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#32CE7A]/40 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-[#C6CFD9]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[#0A1A2F] border border-white/5 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#32CE7A]/40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

