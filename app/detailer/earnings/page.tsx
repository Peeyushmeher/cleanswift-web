import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canViewOrgEarnings } from '@/lib/detailer/permissions';
import { getPlatformFeePercentage, calculatePlatformFee, calculateDetailerPayout } from '@/lib/platform-settings';
import EarningsPageClient from './EarningsPageClient';

export default async function EarningsPage() {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const mode = await getDetailerMode();
  const organization = mode === 'organization' ? await getDetailerOrganization() : null;
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;
  const canViewOrg = mode === 'organization' && organization && orgRole && canViewOrgEarnings(orgRole);

  // Get detailer record
  const { data: detailerData } = await supabase.rpc('get_detailer_by_profile', {
    p_profile_id: null,
  });

  let earningsData: any[] = [];
  let totalEarnings = 0;
  let pendingPayouts = 0;
  let orgEarnings: any = null;
  let teamEarnings: any[] = [];
  let detailerPayouts: any[] = [];
  let payoutBatches: any[] = [];
  let transfers: any[] = [];
  let transferStats: {
    totalTransferred: number;
    pendingTransfers: number;
    failedTransfers: number;
  } = {
    totalTransferred: 0,
    pendingTransfers: 0,
    failedTransfers: 0,
  };

  if (canViewOrg && organization) {
    // Organization mode: Get org-wide earnings
    const { data: orgBookings } = await supabase
      .from('bookings')
      .select(
        `
        id,
        receipt_id,
        status,
        total_amount,
        service_price,
        completed_at,
        team_id,
        detailer_id,
        service:service_id (name),
        team:teams (id, name),
        detailer:detailers (id, full_name)
      `
      )
      .eq('organization_id', organization.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    const completedBookings = orgBookings || [];
    const grossRevenue = completedBookings.reduce((sum, b) => sum + (b.total_amount || b.service_price || 0), 0);
    
    // Calculate platform fee per booking based on each detailer's pricing model
    // For org view, we'll use an average or aggregate approach
    // Get unique detailer IDs to calculate fees properly
    const detailerIds = [...new Set(completedBookings.map((b: any) => b.detailer_id).filter(Boolean))];
    let totalPlatformFee = 0;
    
    // Calculate fee for each booking based on its detailer's pricing model
    for (const booking of completedBookings) {
      const bookingAmount = booking.total_amount || booking.service_price || 0;
      const detailerId = booking.detailer_id;
      if (detailerId) {
        const fee = await calculatePlatformFee(bookingAmount, undefined, detailerId);
        totalPlatformFee += fee;
      } else {
        // Fallback to standard fee if no detailer
        const fee = await calculatePlatformFee(bookingAmount);
        totalPlatformFee += fee;
      }
    }
    
    const platformFee = totalPlatformFee;
    const netRevenue = grossRevenue - platformFee;

    orgEarnings = {
      grossRevenue,
      netRevenue,
      platformFee,
      totalJobs: completedBookings.length,
    };

    // Team earnings breakdown
    const teamMap: Record<string, { name: string; revenue: number; jobs: number }> = {};
    completedBookings.forEach((b: any) => {
      if (b.team_id && b.team) {
        const team = Array.isArray(b.team) ? b.team[0] : b.team;
        if (!teamMap[b.team_id]) {
          teamMap[b.team_id] = { name: team?.name || 'Unknown Team', revenue: 0, jobs: 0 };
        }
        teamMap[b.team_id].revenue += b.total_amount || b.service_price || 0;
        teamMap[b.team_id].jobs += 1;
      }
    });
    teamEarnings = Object.values(teamMap);

    // Get payout batches
    const { data: batches } = await supabase
      .from('payout_batches')
      .select('*')
      .eq('organization_id', organization.id)
      .order('batch_date', { ascending: false })
      .limit(10);

    payoutBatches = batches || [];
  } else if (detailerData?.id) {
    // Solo mode or detailer in org: Get own earnings
    const { data: bookings } = await supabase
      .from('bookings')
      .select(
        `
        id,
        receipt_id,
        status,
        total_amount,
        service_price,
        addons_total,
        tax_amount,
        completed_at,
        scheduled_date,
        service:service_id (name),
        user:user_id (full_name),
        car:car_id (make, model, year)
      `
      )
      .eq('detailer_id', detailerData.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    earningsData = bookings || [];
    totalEarnings = earningsData.reduce((sum, b) => sum + (b.total_amount || b.service_price || 0), 0);
    // Use detailer-specific platform fee calculation
    pendingPayouts = await calculateDetailerPayout(totalEarnings, undefined, detailerData.id);

    // Fetch transfer data and weekly payout batches for solo detailers
    if (mode === 'solo') {
      const { data: transferData } = await supabase
        .from('detailer_transfers')
        .select(`
          *,
          booking:bookings (
            id,
            receipt_id,
            total_amount,
            completed_at,
            service:service_id (name)
          ),
          weekly_payout_batch:solo_weekly_payout_batches (
            id,
            week_start_date,
            week_end_date,
            status
          )
        `)
        .eq('detailer_id', detailerData.id)
        .order('created_at', { ascending: false });

      transfers = transferData || [];

      // Fetch weekly payout batches
      const { data: weeklyBatches } = await supabase
        .from('solo_weekly_payout_batches')
        .select('*')
        .eq('detailer_id', detailerData.id)
        .order('week_start_date', { ascending: false })
        .limit(20);

      payoutBatches = weeklyBatches || [];

      // Calculate transfer stats
      const totalTransferred = transfers
        .filter((t: any) => t.status === 'succeeded')
        .reduce((sum: number, t: any) => sum + (t.amount_cents / 100), 0);

      // Calculate pending transfers (not yet in a batch)
      const pendingTransfers = transfers
        .filter((t: any) => t.status === 'pending' && !t.weekly_payout_batch_id)
        .reduce((sum: number, t: any) => sum + (t.amount_cents / 100), 0);

      // Calculate transfers in processing batches
      const processingTransfers = transfers
        .filter((t: any) => t.status === 'processing' && t.weekly_payout_batch_id)
        .reduce((sum: number, t: any) => sum + (t.amount_cents / 100), 0);

      const failedTransfers = transfers.filter((t: any) => t.status === 'failed').length;

      transferStats = {
        totalTransferred,
        pendingTransfers: pendingTransfers + processingTransfers, // Include both pending and processing
        failedTransfers,
      };

      // Update pendingPayouts to show actual pending transfers if available
      if (pendingTransfers + processingTransfers > 0) {
        pendingPayouts = pendingTransfers + processingTransfers;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Earnings</h1>
          <p className="text-[#C6CFD9]">View your earnings and payout history</p>
        </div>

        <EarningsPageClient 
          earningsData={earningsData}
          totalEarnings={totalEarnings}
          pendingPayouts={pendingPayouts}
          mode={mode}
          orgEarnings={orgEarnings}
          teamEarnings={teamEarnings}
          payoutBatches={payoutBatches}
          platformFeePercentage={await getPlatformFeePercentage()}
          transfers={transfers}
          transferStats={transferStats}
        />
      </div>
    </div>
  );
}

