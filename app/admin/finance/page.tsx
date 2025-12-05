import { createClient } from '@/lib/supabase/server';
import { getPlatformFeePercentage, calculatePlatformFee, calculateDetailerPayout } from '@/lib/platform-settings';
import Link from 'next/link';

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

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ 
    status?: string;
    date_from?: string;
    date_to?: string;
    page?: string;
  }>;
}) {
  // Use regular client - proxy.ts already verified admin access and RLS allows admins
  const supabase = await createClient();
  const params = await searchParams;

  const currentPage = parseInt(params.page || '1');
  const limit = 25;
  const offset = (currentPage - 1) * limit;

  // Get all bookings for stats
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('id, payment_status, total_amount');

  const paidBookings = allBookings?.filter(b => b.payment_status === 'paid') || [];
  const totalRevenue = paidBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0);
  
  // Calculate platform fees per booking based on each detailer's pricing model
  let totalPlatformFees = 0;
  for (const booking of paidBookings) {
    const amount = parseFloat(booking.total_amount || '0');
    // Get detailer_id from booking - need to fetch it
    const { data: bookingWithDetailer } = await supabase
      .from('bookings')
      .select('detailer_id')
      .eq('id', booking.id)
      .single();
    const detailerId = bookingWithDetailer?.detailer_id;
    const fee = await calculatePlatformFee(amount, undefined, detailerId);
    totalPlatformFees += fee;
  }
  
  const platformFees = totalPlatformFees;
  const detailerPayouts = totalRevenue - platformFees;

  const stats = {
    total_revenue: totalRevenue.toFixed(2),
    platform_fees: platformFees.toFixed(2),
    detailer_payouts: detailerPayouts.toFixed(2),
    pending_refunds_count: 0,
  };

  // Get transactions (bookings with payment info)
  let query = supabase
    .from('bookings')
    .select(`
      id,
      receipt_id,
      payment_status,
      total_amount,
      stripe_payment_intent_id,
      created_at,
      user:profiles!bookings_user_id_fkey(full_name),
      detailer:detailers(full_name)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    query = query.eq('payment_status', params.status);
  }
  if (params.date_from) {
    query = query.gte('created_at', params.date_from);
  }
  if (params.date_to) {
    query = query.lte('created_at', params.date_to + 'T23:59:59');
  }

  const { data: transactionsRaw } = await query;

  // Calculate platform fees and payouts for each transaction based on detailer's pricing model
  const transactions = await Promise.all((transactionsRaw || []).map(async (tx: any) => {
    const amount = parseFloat(tx.total_amount || '0');
    // Get detailer_id from the booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('detailer_id')
      .eq('id', tx.id)
      .single();
    const detailerId = booking?.detailer_id;
    const fee = await calculatePlatformFee(amount, undefined, detailerId);
    const payout = amount - fee;
    return {
      ...tx,
      customer: tx.user, // Map user to customer for consistency
      platform_fee: fee.toFixed(2),
      detailer_payout: payout.toFixed(2),
    };
  }));

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Finance</h1>
          <p className="text-[#C6CFD9]">Track revenue, transactions, and payouts</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/finance/payouts"
            className="px-4 py-2 bg-[#0A1A2F] text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
          >
            Payouts
          </Link>
          <Link
            href="/admin/finance/refunds"
            className="px-4 py-2 bg-[#0A1A2F] text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            Refunds
            {stats?.pending_refunds_count > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {stats.pending_refunds_count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Finance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Total Revenue</div>
          <div className="text-2xl font-bold text-[#32CE7A]">${stats?.total_revenue || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Platform Earnings</div>
          <div className="text-2xl font-bold text-white">${stats?.platform_fees || 0}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">This Month</div>
          <div className="text-2xl font-bold text-[#32CE7A]">$0</div>
          <div className="text-xs text-[#C6CFD9]">0 transactions</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Last Month</div>
          <div className="text-2xl font-bold text-white">$0</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/finance"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !params.status
                ? 'bg-[#32CE7A] text-white'
                : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
            }`}
          >
            All
          </Link>
          <Link
            href="/admin/finance?status=paid"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              params.status === 'paid'
                ? 'bg-[#32CE7A] text-white'
                : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
            }`}
          >
            Paid
          </Link>
          <Link
            href="/admin/finance?status=refunded"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              params.status === 'refunded'
                ? 'bg-[#32CE7A] text-white'
                : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
            }`}
          >
            Refunded
          </Link>
          <Link
            href="/admin/finance?status=failed"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              params.status === 'failed'
                ? 'bg-[#32CE7A] text-white'
                : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
            }`}
          >
            Failed
          </Link>
        </div>
      </div>

      {/* Transactions Table */}
      {!transactions || transactions.length === 0 ? (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#C6CFD9] opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          <p className="text-[#C6CFD9]">No transactions found</p>
        </div>
      ) : (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050B12] border-b border-white/10">
                <tr>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Booking</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Customer</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Detailer</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Platform Fee</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Detailer Payout</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-white text-sm font-mono">{tx.receipt_id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white text-sm">{tx.customer?.full_name}</div>
                      <div className="text-xs text-[#C6CFD9]">{tx.customer?.email}</div>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">
                      {tx.detailer?.full_name || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-white font-medium">${tx.total_amount}</td>
                    <td className="py-3 px-4 text-[#C6CFD9] text-sm">${tx.platform_fee}</td>
                    <td className="py-3 px-4 text-[#32CE7A] text-sm">${tx.detailer_payout}</td>
                    <td className="py-3 px-4">
                      <PaymentBadge status={tx.payment_status} />
                    </td>
                    <td className="py-3 px-4 text-[#C6CFD9] text-sm">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/bookings/${tx.id}`}
                          className="text-sm text-[#32CE7A] hover:text-[#6FF0C4]"
                        >
                          View
                        </Link>
                        {tx.stripe_payment_intent_id && (
                          <a
                            href={`https://dashboard.stripe.com/payments/${tx.stripe_payment_intent_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#C6CFD9] hover:text-white"
                          >
                            Stripe
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <div className="text-sm text-[#C6CFD9]">
              Showing {transactions.length} transactions
            </div>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/admin/finance?page=${currentPage - 1}${params.status ? `&status=${params.status}` : ''}`}
                  className="px-3 py-1.5 text-sm bg-[#050B12] text-[#C6CFD9] hover:text-white rounded-lg border border-white/10 transition-colors"
                >
                  Previous
                </Link>
              )}
              {transactions.length === limit && (
                <Link
                  href={`/admin/finance?page=${currentPage + 1}${params.status ? `&status=${params.status}` : ''}`}
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

