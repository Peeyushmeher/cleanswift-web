import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Use service client since proxy.ts already verified admin access
  const supabase = createServiceClient();
  const params = await searchParams;

  const currentPage = parseInt(params.page || '1');
  const limit = 25;
  const offset = (currentPage - 1) * limit;

  // Get all customers (users with role='user')
  const { data: customersRaw } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Get booking stats for each customer
  const customerIds = customersRaw?.map(c => c.id) || [];
  const { data: bookingStats } = await supabase
    .from('bookings')
    .select('user_id, total_amount, payment_status, created_at')
    .in('user_id', customerIds);

  // Transform to include stats
  const customers = customersRaw?.map(c => {
    const customerBookings = bookingStats?.filter(b => b.user_id === c.id) || [];
    const paidBookings = customerBookings.filter(b => b.payment_status === 'paid');
    const lifetimeValue = paidBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0);
    const lastBooking = customerBookings.length > 0 
      ? customerBookings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;

    return {
      ...c,
      total_bookings: customerBookings.length,
      lifetime_value: lifetimeValue,
      last_booking_date: lastBooking?.created_at,
    };
  }) || [];

  // Calculate stats
  const totalCustomers = customers?.length || 0;
  const totalLifetimeValue = customers?.reduce((sum: number, c: any) => sum + parseFloat(c.lifetime_value || 0), 0) || 0;
  const avgValue = totalCustomers > 0 ? totalLifetimeValue / totalCustomers : 0;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Customers</h1>
        <p className="text-[#C6CFD9]">View and manage customer accounts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Total Customers</div>
          <div className="text-2xl font-bold text-white">{totalCustomers}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Total Lifetime Value</div>
          <div className="text-2xl font-bold text-[#32CE7A]">${totalLifetimeValue.toFixed(2)}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Avg. Customer Value</div>
          <div className="text-2xl font-bold text-white">${avgValue.toFixed(2)}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Page</div>
          <div className="text-2xl font-bold text-white">{currentPage}</div>
        </div>
      </div>

      {/* Customers Table */}
      {!customers || customers.length === 0 ? (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#C6CFD9] opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p className="text-[#C6CFD9]">No customers found</p>
        </div>
      ) : (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050B12] border-b border-white/10">
                <tr>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Customer</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Contact</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">City</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Bookings</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Lifetime Value</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Last Booking</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer: any) => (
                  <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#32CE7A]/20 flex items-center justify-center flex-shrink-0">
                          {customer.avatar_url ? (
                            <img src={customer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-[#32CE7A] font-semibold">
                              {customer.full_name?.[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium">{customer.full_name}</div>
                          <div className="text-xs text-[#C6CFD9]">
                            Since {new Date(customer.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-white">{customer.email}</div>
                      <div className="text-xs text-[#C6CFD9]">{customer.phone || 'No phone'}</div>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">{customer.city || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <div className="text-white text-sm">{customer.total_bookings} total</div>
                      <div className="text-xs text-[#C6CFD9]">{customer.completed_bookings} completed</div>
                    </td>
                    <td className="py-3 px-4 text-[#32CE7A] font-medium">${customer.lifetime_value}</td>
                    <td className="py-3 px-4 text-[#C6CFD9] text-sm">
                      {customer.last_booking_date 
                        ? new Date(customer.last_booking_date).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/customers/${customer.id}`}
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
              Showing {customers.length} customers
            </div>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/admin/customers?page=${currentPage - 1}`}
                  className="px-3 py-1.5 text-sm bg-[#050B12] text-[#C6CFD9] hover:text-white rounded-lg border border-white/10 transition-colors"
                >
                  Previous
                </Link>
              )}
              {customers.length === limit && (
                <Link
                  href={`/admin/customers?page=${currentPage + 1}`}
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

