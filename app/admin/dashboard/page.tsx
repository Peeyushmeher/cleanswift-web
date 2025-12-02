import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';

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

// Alert card component
function AlertCard({ 
  title, 
  count, 
  icon, 
  color,
  href 
}: { 
  title: string; 
  count: number; 
  icon: React.ReactNode;
  color: string;
  href: string;
}) {
  if (count === 0) return null;
  
  return (
    <Link href={href} className={`p-4 rounded-xl border ${color} hover:opacity-80 transition-opacity`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-current/10">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-sm opacity-80">{title}</div>
        </div>
      </div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  // Use service client since proxy.ts already verified admin access
  const supabase = createServiceClient();

  // Get today's date for filtering
  const today = new Date().toISOString().split('T')[0];

  // Get bookings stats
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('status, payment_status, total_amount, scheduled_date, created_at');

  const todayBookings = allBookings?.filter(b => b.scheduled_date === today) || [];
  const bookingsToday = todayBookings.length;
  const revenueToday = todayBookings
    .filter(b => b.payment_status === 'paid')
    .reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0);

  // Count by status for today
  const pendingToday = todayBookings.filter(b => b.status === 'pending').length;
  const confirmedToday = todayBookings.filter(b => ['accepted', 'paid'].includes(b.status)).length;
  const inProgressToday = todayBookings.filter(b => b.status === 'in_progress').length;
  const completedToday = todayBookings.filter(b => b.status === 'completed').length;

  // Get unassigned bookings within 2 hours
  const { data: unassignedBookings } = await supabase
    .from('bookings')
    .select('id')
    .is('detailer_id', null)
    .in('status', ['pending', 'paid', 'accepted']);

  // Calculate platform earnings (15% fee)
  const platformEarningsToday = revenueToday * 0.15;

  const stats = {
    bookings_today: bookingsToday,
    pending_today: pendingToday,
    confirmed_today: confirmedToday,
    in_progress_today: inProgressToday,
    completed_today: completedToday,
    revenue_today: revenueToday,
    platform_earnings_today: platformEarningsToday,
    unassigned_urgent: unassignedBookings?.length || 0,
    failed_payments: 0,
    pending_refunds: 0,
  };

  // Get today's bookings with details
  const { data: todaysBookingsRaw } = await supabase
    .from('bookings')
    .select(`
      id,
      receipt_id,
      status,
      scheduled_time_start,
      total_amount,
      user:profiles!bookings_user_id_fkey(full_name),
      detailer:detailers(full_name),
      service:services(name)
    `)
    .eq('scheduled_date', today)
    .order('scheduled_time_start');

  const todaysBookings = todaysBookingsRaw || [];

  // Get recent activity (last 20 bookings)
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      receipt_id,
      status,
      created_at,
      user:profiles!bookings_user_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  const recentActivity = recentBookings?.map(b => ({
    event_type: 'booking_created',
    description: `Booking ${b.receipt_id} - ${b.status}`,
    actor_name: b.user?.full_name || 'Customer',
    created_at: b.created_at,
    entity_id: b.id,
  })) || [];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Overview</h1>
        <p className="text-[#C6CFD9]">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Today's KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">Today's Bookings</div>
          <div className="text-3xl font-bold text-white">{stats?.today?.total_bookings || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">Confirmed</div>
          <div className="text-3xl font-bold text-cyan-400">{stats?.today?.confirmed || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">In Progress</div>
          <div className="text-3xl font-bold text-indigo-400">{stats?.today?.in_progress || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">Completed</div>
          <div className="text-3xl font-bold text-[#32CE7A]">{stats?.today?.completed || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">Today's Revenue</div>
          <div className="text-3xl font-bold text-[#32CE7A]">${stats?.today?.revenue_gross || 0}</div>
        </div>
      </div>

      {/* Alerts Section */}
      {(stats?.alerts?.unassigned_soon > 0 || stats?.alerts?.failed_payments > 0 || stats?.alerts?.pending_refunds > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            Alerts Requiring Attention
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AlertCard
              title="Unassigned (< 2hrs)"
              count={stats?.alerts?.unassigned_soon || 0}
              color="bg-orange-500/10 border-orange-500/30 text-orange-400"
              href="/admin/bookings?filter=unassigned"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            />
            <AlertCard
              title="Failed Payments"
              count={stats?.alerts?.failed_payments || 0}
              color="bg-red-500/10 border-red-500/30 text-red-400"
              href="/admin/finance?filter=failed"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              }
            />
            <AlertCard
              title="Pending Refunds"
              count={stats?.alerts?.pending_refunds || 0}
              color="bg-purple-500/10 border-purple-500/30 text-purple-400"
              href="/admin/finance/refunds"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
              }
            />
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Today's Jobs - Takes 2 columns */}
        <div className="xl:col-span-2 bg-[#0A1A2F] border border-white/5 rounded-xl">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Today's Jobs</h2>
            <Link href="/admin/bookings?date=today" className="text-sm text-[#32CE7A] hover:text-[#6FF0C4]">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {!todaysBookings || todaysBookings.length === 0 ? (
              <div className="p-8 text-center text-[#C6CFD9]">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <p>No bookings scheduled for today</p>
              </div>
            ) : (
              todaysBookings.map((booking: any) => (
                <div key={booking.id} className="p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{booking.scheduled_time_start?.slice(0, 5)}</span>
                        <span className="text-[#C6CFD9]">•</span>
                        <span className="text-[#C6CFD9] truncate">{booking.customer?.full_name}</span>
                      </div>
                      <div className="text-sm text-[#C6CFD9] mb-2">{booking.service?.name} • {booking.city}</div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={booking.status} />
                        {booking.detailer ? (
                          <span className="text-xs text-[#C6CFD9]">
                            Assigned to {booking.detailer.full_name}
                          </span>
                        ) : (
                          <span className="text-xs text-orange-400 font-medium">Unassigned</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">${booking.total_amount}</span>
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="p-2 text-[#C6CFD9] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl">
          <div className="p-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto">
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="text-center text-[#C6CFD9] py-8">
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity: any, index: number) => (
                  <div key={activity.id || index} className="flex gap-3">
                    <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      activity.event_type === 'booking_completed' ? 'bg-[#32CE7A]' :
                      activity.event_type === 'booking_created' ? 'bg-blue-400' :
                      activity.event_type === 'refund' ? 'bg-purple-400' :
                      'bg-[#C6CFD9]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        {activity.event_type === 'booking_created' && (
                          <>New booking from <span className="font-medium">{activity.details?.customer_name}</span></>
                        )}
                        {activity.event_type === 'booking_completed' && (
                          <>Booking completed by <span className="font-medium">{activity.details?.detailer_name}</span></>
                        )}
                        {!['booking_created', 'booking_completed'].includes(activity.event_type) && (
                          <>{activity.event_type.replace('_', ' ')}</>
                        )}
                      </p>
                      <p className="text-xs text-[#C6CFD9]">
                        {activity.details?.service_name || activity.reference}
                        {activity.details?.total_amount && ` • $${activity.details.total_amount}`}
                      </p>
                      <p className="text-xs text-[#C6CFD9]/60 mt-1">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">Total Customers</div>
          <div className="text-2xl font-bold text-white">{stats?.overall?.total_customers || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">Active Detailers</div>
          <div className="text-2xl font-bold text-white">{stats?.overall?.total_detailers || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">This Month's Bookings</div>
          <div className="text-2xl font-bold text-white">{stats?.this_month?.bookings || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
          <div className="text-[#C6CFD9] text-sm mb-1">This Month's Revenue</div>
          <div className="text-2xl font-bold text-[#32CE7A]">${stats?.this_month?.revenue || 0}</div>
        </div>
      </div>
    </div>
  );
}
