import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import BookingsFilters from '@/components/admin/BookingsFilters';

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    requires_payment: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    offered: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    accepted: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    completed: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    no_show: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    unpaid: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    requires_payment: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paid: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
    refunded: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'offered', label: 'Offered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    status?: string;
    payment_status?: string;
    date_from?: string;
    date_to?: string;
    city?: string;
    page?: string;
  }>;
}) {
  // Use service client since proxy.ts already verified admin access
  const supabase = createServiceClient();
  const params = await searchParams;

  const statusFilter = params.status || null;
  const currentPage = parseInt(params.page || '1');
  const limit = 25;
  const offset = (currentPage - 1) * limit;

  // Build query for bookings with related data
  let query = supabase
    .from('bookings')
    .select(`
      id,
      receipt_id,
      status,
      payment_status,
      scheduled_date,
      scheduled_time_start,
      scheduled_time_end,
      total_amount,
      created_at,
      address_line1,
      city,
      province,
      postal_code,
      user:profiles!bookings_user_id_fkey(id, full_name, email, phone),
      detailer:detailers(id, full_name, rating),
      service:services(id, name, price),
      car:cars(id, make, model, year, license_plate)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }
  if (params.date_from) {
    query = query.gte('scheduled_date', params.date_from);
  }
  if (params.date_to) {
    query = query.lte('scheduled_date', params.date_to);
  }

  const { data: rawBookings } = await query;

  // Transform data to match expected format
  const bookings = rawBookings?.map(b => ({
    ...b,
    address: {
      address_line1: b.address_line1,
      city: b.city,
      province: b.province,
      postal_code: b.postal_code,
    }
  })) || [];

  // Get unique cities for filter
  const { data: cities } = await supabase
    .from('bookings')
    .select('city')
    .order('city');
  
  const uniqueCities = [...new Set(cities?.map(c => c.city).filter(Boolean) || [])];

  // Filter by payment status and city client-side (RPC doesn't support these yet)
  let filteredBookings = bookings || [];
  if (params.payment_status) {
    filteredBookings = filteredBookings.filter((b: any) => b.payment_status === params.payment_status);
  }
  if (params.city) {
    filteredBookings = filteredBookings.filter((b: any) => b.address?.city === params.city);
  }

  // Build filter URL helper - creates URL string for filters
  const buildFilterUrl = (newParams: Record<string, string>) => {
    const current = new URLSearchParams();
    if (params.status) current.set('status', params.status);
    if (params.payment_status) current.set('payment_status', params.payment_status);
    if (params.date_from) current.set('date_from', params.date_from);
    if (params.date_to) current.set('date_to', params.date_to);
    if (params.city) current.set('city', params.city);
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });
    
    return `/admin/bookings?${current.toString()}`;
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Bookings</h1>
        <p className="text-[#C6CFD9]">Manage all platform bookings</p>
      </div>

      {/* Filters */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((option) => (
              <Link
                key={option.value}
                href={buildFilterUrl({ status: option.value, page: '1' })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  (statusFilter || '') === option.value
                    ? 'bg-[#32CE7A] text-white'
                    : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Additional Filters Row - Client Component */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-3">
          <BookingsFilters cities={uniqueCities} />

          {/* Clear Filters */}
          {(params.status || params.payment_status || params.date_from || params.date_to || params.city) && (
            <Link
              href="/admin/bookings"
              className="px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 border border-red-500/30 transition-colors"
            >
              Clear Filters
            </Link>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      {filteredBookings.length === 0 ? (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#C6CFD9] opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <p className="text-[#C6CFD9]">No bookings found</p>
        </div>
      ) : (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050B12] border-b border-white/10">
                <tr>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">ID</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Customer</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Service</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Detailer</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Payment</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">City</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking: any) => (
                  <tr key={booking.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-white text-sm font-mono">{booking.receipt_id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white text-sm">{booking.user?.full_name || 'N/A'}</div>
                      <div className="text-[#C6CFD9] text-xs">{booking.user?.email}</div>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">{booking.service?.name || 'N/A'}</td>
                    <td className="py-3 px-4">
                      {booking.detailer ? (
                        <span className="text-white text-sm">{booking.detailer.full_name}</span>
                      ) : (
                        <span className="text-orange-400 text-sm font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="py-3 px-4">
                      <PaymentBadge status={booking.payment_status} />
                    </td>
                    <td className="py-3 px-4 text-white text-sm font-medium">${booking.total_amount || 0}</td>
                    <td className="py-3 px-4 text-[#C6CFD9] text-sm">{booking.address?.city || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <div className="text-white text-sm">
                        {new Date(booking.scheduled_date).toLocaleDateString()}
                      </div>
                      <div className="text-[#C6CFD9] text-xs">
                        {booking.scheduled_time_start?.slice(0, 5)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[#32CE7A] hover:text-[#6FF0C4] hover:bg-[#32CE7A]/10 rounded-lg transition-colors"
                      >
                        View
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <div className="text-sm text-[#C6CFD9]">
              Showing {filteredBookings.length} bookings
            </div>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  href={buildFilterUrl({ page: String(currentPage - 1) })}
                  className="px-3 py-1.5 text-sm bg-[#050B12] text-[#C6CFD9] hover:text-white rounded-lg border border-white/10 transition-colors"
                >
                  Previous
                </Link>
              )}
              {filteredBookings.length === limit && (
                <Link
                  href={buildFilterUrl({ page: String(currentPage + 1) })}
                  className="px-3 py-1.5 text-sm bg-[#050B12] text-[#C6CFD9] hover:text-white rounded-lg border border-white/10 transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
