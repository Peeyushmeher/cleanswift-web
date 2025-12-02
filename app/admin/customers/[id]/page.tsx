import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    accepted: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    completed: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
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
    paid: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
    refunded: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  );
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get customer full profile
  const { data: customer, error } = await supabase.rpc('get_customer_full_profile', {
    p_customer_id: id,
  });

  if (error || !customer) {
    notFound();
  }

  // Calculate completion rate
  const completionRate = customer.stats.total_bookings > 0
    ? Math.round((customer.stats.completed_bookings / customer.stats.total_bookings) * 100)
    : 0;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/customers"
          className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Customers
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#32CE7A]/20 flex items-center justify-center flex-shrink-0">
              {customer.avatar_url ? (
                <img src={customer.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <span className="text-[#32CE7A] font-bold text-2xl">
                  {customer.full_name?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{customer.full_name}</h1>
              <p className="text-[#C6CFD9]">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold text-[#32CE7A]">${customer.stats.lifetime_value}</div>
            <div className="text-sm text-[#C6CFD9]">Lifetime Value</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Total Bookings</div>
              <div className="text-2xl font-bold text-white">{customer.stats.total_bookings}</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-[#32CE7A]">{customer.stats.completed_bookings}</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Cancelled</div>
              <div className="text-2xl font-bold text-red-400">{customer.stats.cancelled_bookings}</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Avg. Order</div>
              <div className="text-2xl font-bold text-white">${customer.stats.avg_booking_value}</div>
            </div>
          </div>

          {/* Booking History */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Booking History
            </h2>
            {customer.bookings && customer.bookings.length > 0 ? (
              <div className="space-y-3">
                {customer.bookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-[#050B12] rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{booking.service_name}</span>
                        <span className="text-[#C6CFD9]">•</span>
                        <span className="text-[#C6CFD9] text-sm">{booking.city}</span>
                      </div>
                      <div className="text-sm text-[#C6CFD9]">
                        {booking.detailer_name || 'Unassigned'} • {new Date(booking.scheduled_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={booking.status} />
                      <PaymentBadge status={booking.payment_status} />
                      <div className="text-white font-medium">${booking.total_amount}</div>
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="p-1 text-[#C6CFD9] hover:text-white"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9]">No bookings yet</p>
            )}
          </div>

          {/* Vehicles */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              Vehicles ({customer.cars?.length || 0})
            </h2>
            {customer.cars && customer.cars.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customer.cars.map((car: any) => (
                  <div key={car.id} className="p-3 bg-[#050B12] rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">
                        {car.year} {car.make} {car.model}
                      </span>
                      {car.is_primary && (
                        <span className="px-2 py-0.5 text-xs bg-[#32CE7A]/20 text-[#32CE7A] rounded">Primary</span>
                      )}
                    </div>
                    <div className="text-sm text-[#C6CFD9]">
                      {car.color && `${car.color} • `}{car.license_plate}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9]">No vehicles registered</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Contact Info</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[#C6CFD9]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <span className="text-sm">{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-3 text-[#C6CFD9]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  <span className="text-sm">{customer.phone}</span>
                </div>
              )}
              {customer.stripe_customer_id && (
                <a
                  href={`https://dashboard.stripe.com/customers/${customer.stripe_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#32CE7A] hover:text-[#6FF0C4] mt-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  View in Stripe
                </a>
              )}
            </div>
          </div>

          {/* Saved Addresses */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Saved Addresses</h2>
            {customer.saved_addresses && customer.saved_addresses.length > 0 ? (
              <div className="space-y-3">
                {customer.saved_addresses.map((address: any) => (
                  <div key={address.id} className="p-3 bg-[#050B12] rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{address.name}</span>
                      {address.is_default && (
                        <span className="px-2 py-0.5 text-xs bg-[#32CE7A]/20 text-[#32CE7A] rounded">Default</span>
                      )}
                    </div>
                    <div className="text-sm text-[#C6CFD9]">
                      {address.address_line1}
                    </div>
                    <div className="text-sm text-[#C6CFD9]">
                      {address.city}, {address.province} {address.postal_code}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9] text-sm">No saved addresses</p>
            )}
          </div>

          {/* Favorite Detailers */}
          {customer.favorite_detailers && customer.favorite_detailers.length > 0 && (
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Favorite Detailers</h2>
              <div className="space-y-2">
                {customer.favorite_detailers.map((fav: any) => (
                  <Link
                    key={fav.id}
                    href={`/admin/detailers/${fav.detailer_id}`}
                    className="flex items-center justify-between p-2 bg-[#050B12] rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-white">{fav.detailer_name}</span>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm">{fav.detailer_rating?.toFixed(1) || 'N/A'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

