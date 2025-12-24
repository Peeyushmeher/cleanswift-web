import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import CalendarView from './CalendarView';
import StatsGrid from '@/components/detailer/StatsGrid';
import TodaysJobsList from '@/components/detailer/TodaysJobsList';
import EarningsChart from '@/components/detailer/EarningsChart';
import AvailabilityCalendar from '@/components/detailer/AvailabilityCalendar';
import { filterBookingsByDateRange, calculateEarnings, formatCurrency, formatDate } from '@/lib/detailer/dashboard-utils';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';

export default async function DetailerDashboardPage() {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const mode = await getDetailerMode();
  const organization = mode === 'organization' ? await getDetailerOrganization() : null;
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;

  // Get detailer record
  const { data: detailerData } = await supabase.rpc('get_detailer_by_profile', {
    p_profile_id: null,
  });

  let myBookings: any[] = [];
  let orgBookings: any[] = [];
  let availabilitySlots: any[] = [];
  let daysOff: any[] = [];
  let filteredBookings: any[] = [];
  let todaysBookings: any[] = [];
  let stats = {
    upcoming: 0,
    inProgress: 0,
    completed: 0,
    totalEarnings: 0,
  };
  let orgStats = {
    totalJobs: 0,
    activeDetailers: 0,
    teams: 0,
    totalRevenue: 0,
  };
  let earningsData: Array<{ date: string; amount: number }> = [];
  let rating = 0;
  let reviewCount = 0;
  let issues: Array<{ type: string; message: string; bookingId?: string }> = [];

  if (detailerData?.id) {
    // Get bookings based on mode
    if (mode === 'organization' && organization) {
      // Organization mode: Get all org bookings (if manager/dispatcher/owner)
      if (orgRole && ['owner', 'manager', 'dispatcher'].includes(orgRole)) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select(
            `
            id,
            receipt_id,
            status,
            payment_status,
            scheduled_date,
            scheduled_time_start,
            scheduled_time_end,
            scheduled_start,
            scheduled_end,
            total_amount,
            organization_id,
            team_id,
            detailer_id,
            service:service_id (id, name, price, duration_minutes),
            car:car_id (id, make, model, year, license_plate),
            user:user_id (id, full_name, phone, email),
            detailer:detailers (id, full_name),
            address_line1,
            city,
            province,
            postal_code
          `
          )
          .eq('organization_id', organization.id)
          .in('status', ['accepted', 'in_progress', 'completed', 'scheduled'])
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time_start', { ascending: true });

        orgBookings = bookings || [];
        
        // Also get own bookings for personal view
        const { data: myBookingsData } = await supabase
          .from('bookings')
          .select('*')
          .eq('detailer_id', detailerData.id)
          .in('status', ['accepted', 'in_progress', 'completed']);

        myBookings = myBookingsData || [];

        // Calculate org stats
        orgStats.totalJobs = orgBookings.length;
        orgStats.totalRevenue = orgBookings
          .filter((b) => b.status === 'completed')
          .reduce((sum, b) => sum + (b.total_amount || 0), 0);

        // Get active detailers count
        const { data: activeDetailers } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .eq('role', 'detailer');

        orgStats.activeDetailers = activeDetailers?.length || 0;

        // Get teams count
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('is_active', true);

        orgStats.teams = teams?.length || 0;

        // Check for issues (late jobs, unassigned jobs)
        const now = new Date();
        issues = orgBookings
          .filter((b) => {
            if (b.status === 'scheduled' && !b.detailer_id) {
              return true; // Unassigned job
            }
            if (b.scheduled_start) {
              const scheduledTime = new Date(b.scheduled_start);
              if (scheduledTime < now && ['scheduled', 'accepted'].includes(b.status)) {
                return true; // Late job
              }
            }
            return false;
          })
          .map((b) => ({
            type: !b.detailer_id ? 'unassigned' : 'late',
            message: !b.detailer_id
              ? `Job ${b.receipt_id} needs assignment`
              : `Job ${b.receipt_id} is running late`,
            bookingId: b.id,
          }))
          .slice(0, 5); // Limit to 5 issues
      } else {
        // Detailer in org: only see own bookings
        const { data: bookings } = await supabase
          .from('bookings')
          .select(
            `
            id,
            receipt_id,
            status,
            payment_status,
            scheduled_date,
            scheduled_time_start,
            scheduled_time_end,
            scheduled_start,
            scheduled_end,
            total_amount,
            service:service_id (id, name, price, duration_minutes),
            car:car_id (id, make, model, year, license_plate),
            user:user_id (id, full_name, phone, email),
            address_line1,
            city,
            province,
            postal_code
          `
          )
          .eq('detailer_id', detailerData.id)
          .in('status', ['accepted', 'in_progress', 'completed'])
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time_start', { ascending: true });

        myBookings = bookings || [];
      }
    } else {
      // Solo mode: Get own bookings only
      const { data: bookings } = await supabase
        .from('bookings')
        .select(
          `
          id,
          receipt_id,
          status,
          payment_status,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          scheduled_start,
          scheduled_end,
          total_amount,
          service:service_id (id, name, price, duration_minutes),
          car:car_id (id, make, model, year, license_plate),
          user:user_id (id, full_name, phone, email),
          address_line1,
          city,
          province,
          postal_code
        `
        )
        .eq('detailer_id', detailerData.id)
        .in('status', ['accepted', 'in_progress', 'completed'])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time_start', { ascending: true });

      myBookings = bookings || [];
    }

    // Get detailer availability
    const { data: availability } = await supabase
      .from('detailer_availability')
      .select('*')
      .eq('detailer_id', detailerData.id)
      .eq('is_active', true);

    availabilitySlots = availability || [];

    // Get days off
    const { data: daysOffData } = await supabase.rpc('get_detailer_days_off');
    daysOff = daysOffData || [];

    // Filter bookings to only show those within availability windows
    filteredBookings = myBookings.filter((booking) => {
      if (!booking.scheduled_date || !booking.scheduled_time_start) return false;

      // Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
      // Parse as local date to avoid timezone issues
      const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
      const bookingDate = dateOnlyPattern.test(booking.scheduled_date)
        ? (() => {
            const [year, month, day] = booking.scheduled_date.split('-').map(Number);
            return new Date(year, month - 1, day);
          })()
        : new Date(booking.scheduled_date);
      const dayOfWeek = bookingDate.getDay();

      // Find matching availability slot
      const matchingSlot = availabilitySlots.find(
        (slot) => slot.day_of_week === dayOfWeek
      );

      if (!matchingSlot) return false;

      // Check if booking time falls within availability window
      const bookingStartTime = booking.scheduled_time_start;
      const bookingEndTime = booking.scheduled_time_end || booking.scheduled_time_start;

      // Compare times (format: HH:MM:SS)
      const slotStart = matchingSlot.start_time;
      const slotEnd = matchingSlot.end_time;

      // Convert to comparable format
      const bookingStart = bookingStartTime.substring(0, 5); // HH:MM
      const bookingEnd = bookingEndTime.substring(0, 5); // HH:MM
      const slotStartTime = slotStart.substring(0, 5); // HH:MM
      const slotEndTime = slotEnd.substring(0, 5); // HH:MM

      // Check if booking time is within availability window
      return bookingStart >= slotStartTime && bookingEnd <= slotEndTime;
    });

    // Calculate stats from bookings (use org bookings if in org mode with permissions)
    const bookingsForStats = mode === 'organization' && orgBookings.length > 0 ? orgBookings : filteredBookings;
    
    stats.upcoming = bookingsForStats.filter((b) => b.status === 'accepted' || b.status === 'scheduled').length;
    stats.inProgress = bookingsForStats.filter((b) => b.status === 'in_progress').length;
    stats.completed = bookingsForStats.filter((b) => b.status === 'completed').length;
    stats.totalEarnings = bookingsForStats
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_amount || b.service?.price || 0), 0);

    // Get today's bookings (use appropriate bookings list)
    const bookingsForToday = mode === 'organization' && orgBookings.length > 0 ? orgBookings : filteredBookings;
    todaysBookings = filterBookingsByDateRange(bookingsForToday, 'today');

    // Get earnings data for chart (last 7 days)
    const bookingsForEarnings = mode === 'organization' && orgBookings.length > 0 ? orgBookings : filteredBookings;
    const completedBookings = bookingsForEarnings.filter((b) => b.status === 'completed');
    const earningsByDate: Record<string, number> = {};
    
    completedBookings.forEach((booking) => {
      const date = booking.completed_at || booking.scheduled_date || booking.created_at;
      if (date) {
        const dateKey = new Date(date).toISOString().split('T')[0];
        const amount = booking.service?.price || booking.total_amount || 0;
        earningsByDate[dateKey] = (earningsByDate[dateKey] || 0) + amount;
      }
    });

    // Generate last 7 days of earnings data
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      earningsData.push({
        date: dateKey,
        amount: earningsByDate[dateKey] || 0,
      });
    }

    // Get rating and review count
    rating = detailerData.rating || 0;
    reviewCount = detailerData.review_count || 0;
  }

  // Build stats cards based on mode
  const statsCards = mode === 'organization' && orgRole && ['owner', 'manager'].includes(orgRole)
    ? [
        { label: 'Total Jobs', value: orgStats.totalJobs, color: 'default' as const },
        { label: 'Active Detailers', value: orgStats.activeDetailers, color: 'default' as const },
        { label: 'Teams', value: orgStats.teams, color: 'default' as const },
        { label: 'Total Revenue', value: formatCurrency(orgStats.totalRevenue), color: 'success' as const },
      ]
    : [
        { label: 'Upcoming', value: stats.upcoming, color: 'default' as const },
        { label: 'In Progress', value: stats.inProgress, color: 'default' as const },
        { label: 'Completed', value: stats.completed, color: 'default' as const },
        { label: 'Total Earnings', value: formatCurrency(stats.totalEarnings), color: 'success' as const },
      ];

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-[#C6CFD9]">Welcome back, {profile.full_name}</p>
        </div>

        {/* Stats Grid */}
        <StatsGrid stats={statsCards} />

        {/* Issues/Alerts Section (Org Mode Only) */}
        {mode === 'organization' && issues.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-yellow-400 mb-4">⚠️ Issues That Need Attention</h2>
            <div className="space-y-2">
              {issues.map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-[#050B12] rounded-lg">
                  <div>
                    <span className="text-yellow-400 font-medium">{issue.type === 'unassigned' ? 'Unassigned' : 'Late'}</span>
                    <span className="text-[#C6CFD9] ml-2">{issue.message}</span>
                  </div>
                  {issue.bookingId && (
                    <Link
                      href={`/detailer/bookings/${issue.bookingId}`}
                      className="text-[#32CE7A] hover:text-[#6FF0C4] text-sm font-medium"
                    >
                      View →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Earnings and Rating Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 mt-8">
          {/* Earnings Chart */}
          <div className="lg:col-span-2 bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Earnings (Last 7 Days)</h2>
            <EarningsChart data={earningsData} period="day" />
          </div>

          {/* Rating Summary */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Rating</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-4xl font-bold text-[#32CE7A]">{rating.toFixed(1)}</span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-2xl ${
                      i < Math.round(rating) ? 'text-yellow-400' : 'text-[#C6CFD9]'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-[#C6CFD9] mb-4">{reviewCount} reviews</p>
            <Link
              href="/detailer/reviews"
              className="text-[#32CE7A] hover:text-[#6FF0C4] text-sm font-medium"
            >
              View all reviews →
            </Link>
          </div>
        </div>

        {/* Today's Jobs */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Today's Jobs</h2>
          <TodaysJobsList bookings={todaysBookings} />
        </div>

        {/* Availability Calendar Preview */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Weekly Availability</h2>
            <Link
              href="/detailer/availability"
              className="text-[#32CE7A] hover:text-[#6FF0C4] text-sm font-medium"
            >
              Manage Availability →
            </Link>
          </div>
          <AvailabilityCalendar
            availability={availabilitySlots}
            daysOff={daysOff}
            bookings={mode === 'organization' && orgBookings.length > 0 ? orgBookings : filteredBookings}
          />
        </div>

        {/* Calendar View */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            {mode === 'organization' ? 'Organization Calendar' : 'Calendar'}
          </h2>
          <CalendarView bookings={mode === 'organization' && orgBookings.length > 0 ? orgBookings : filteredBookings} />
        </div>

        {/* Upcoming Bookings List */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            {mode === 'organization' ? 'All Bookings' : 'Upcoming Bookings'}
          </h2>
          {(mode === 'organization' && orgBookings.length > 0 ? orgBookings : filteredBookings).length === 0 ? (
            <p className="text-[#C6CFD9]">
              {mode === 'organization' ? 'No bookings found' : 'No upcoming bookings in your availability window'}
            </p>
          ) : (
            <div className="space-y-4">
              {(mode === 'organization' && orgBookings.length > 0 ? orgBookings : filteredBookings).slice(0, 10).map((booking) => (
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
                      </div>
                      <div className="text-sm text-[#C6CFD9] mt-1">
                        {booking.scheduled_date && booking.scheduled_time_start
                          ? `${formatDate(booking.scheduled_date)} at ${booking.scheduled_time_start.substring(0, 5)}`
                          : booking.scheduled_start
                          ? formatDate(booking.scheduled_start, 'short')
                          : 'Date TBD'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${booking.service?.price || booking.total_amount || 0}</div>
                      <div className="text-xs text-[#C6CFD9] mt-1 capitalize">{booking.status}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

