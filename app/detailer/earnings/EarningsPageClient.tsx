'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/detailer/dashboard-utils';
import EarningsChart from '@/components/detailer/EarningsChart';
import OrgEarningsSummary from '@/components/detailer/OrgEarningsSummary';
import TeamEarningsBreakdown from '@/components/detailer/TeamEarningsBreakdown';
import PayoutBatches from '@/components/detailer/PayoutBatches';
import TransferHistory from '@/components/detailer/TransferHistory';
import WeeklyPayoutSummary from '@/components/detailer/WeeklyPayoutSummary';

interface EarningsPageClientProps {
  earningsData: any[];
  totalEarnings: number;
  pendingPayouts: number;
  mode?: 'solo' | 'organization';
  orgEarnings?: {
    grossRevenue: number;
    netRevenue: number;
    platformFee: number;
    totalJobs: number;
  } | null;
  teamEarnings?: Array<{ name: string; revenue: number; jobs: number }>;
  payoutBatches?: any[];
  platformFeePercentage?: number;
  transfers?: any[];
  transferStats?: {
    totalTransferred: number;
    pendingTransfers: number;
    failedTransfers: number;
  };
}

export default function EarningsPageClient({
  earningsData,
  totalEarnings,
  pendingPayouts,
  mode = 'solo',
  orgEarnings,
  teamEarnings = [],
  payoutBatches = [],
  platformFeePercentage = 15,
  transfers = [],
  transferStats,
}: EarningsPageClientProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  // Prepare chart data
  const chartData = earningsData.slice(0, 7).map((booking) => ({
    date: booking.scheduled_date || booking.completed_at || booking.created_at,
    amount: booking.total_amount || booking.service_price || 0,
  }));

  const isOrgMode = mode === 'organization' && orgEarnings;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {isOrgMode ? (
        <OrgEarningsSummary
          grossRevenue={orgEarnings.grossRevenue}
          netRevenue={orgEarnings.netRevenue}
          platformFee={orgEarnings.platformFee}
          totalJobs={orgEarnings.totalJobs}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="text-[#C6CFD9] text-sm mb-2">Total Earnings</div>
          <div className="text-3xl font-bold text-[#32CE7A]">
            {formatCurrency(totalEarnings)}
          </div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="text-[#C6CFD9] text-sm mb-2">Pending Payouts</div>
          <div className="text-3xl font-bold text-yellow-400">
            {formatCurrency(pendingPayouts)}
          </div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="text-[#C6CFD9] text-sm mb-2">Next Payout</div>
          <div className="text-lg font-semibold text-[#C6CFD9]">
            {transferStats && transferStats.pendingTransfers > 0
              ? 'Weekly (Wed)'
              : 'Weekly (Wed)'}
          </div>
        </div>
        </div>
      )}

      {/* Team Earnings Breakdown (Org Mode) */}
      {isOrgMode && teamEarnings.length > 0 && (
        <TeamEarningsBreakdown teams={teamEarnings} />
      )}

      {/* Payout Batches (Org Mode) */}
      {isOrgMode && payoutBatches.length > 0 && (
        <PayoutBatches batches={payoutBatches} />
      )}

      {/* Weekly Payout Summary (Solo Mode) */}
      {!isOrgMode && (
        <WeeklyPayoutSummary
          batches={payoutBatches || []}
          pendingAmount={transferStats?.pendingTransfers || 0}
          pendingCount={transfers?.filter((t: any) => 
            (t.status === 'pending' && !t.weekly_payout_batch_id) || 
            (t.status === 'processing' && t.weekly_payout_batch_id)
          ).length || 0}
        />
      )}

      {/* Transfer History (Solo Mode) */}
      {!isOrgMode && transfers && transfers.length > 0 && transferStats && (
        <TransferHistory transfers={transfers} stats={transferStats} />
      )}

      {/* Earnings Chart */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Earnings Overview</h2>
        <EarningsChart data={chartData} period={period} />
      </div>

      {/* Earnings Table */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Earnings Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Job ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Payout
                </th>
                {!isOrgMode && transfers && transfers.length > 0 && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                    Transfer Status
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {earningsData.map((booking) => {
                const amount = booking.total_amount || booking.service_price || 0;
                const payout = amount * (1 - platformFeePercentage / 100);
                
                // Find transfer for this booking
                const transfer = transfers?.find((t: any) => t.booking_id === booking.id);
                
                return (
                  <tr key={booking.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-white">
                      {formatDate(booking.scheduled_date || booking.completed_at, 'short')}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#C6CFD9] font-mono">
                      {booking.receipt_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {booking.service?.name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {booking.user?.full_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {formatCurrency(amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#32CE7A] font-semibold">
                      {formatCurrency(payout)}
                    </td>
                    {!isOrgMode && transfers && transfers.length > 0 && (
                      <td className="px-4 py-3 text-sm">
                        {transfer ? (
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              transfer.status === 'succeeded'
                                ? 'bg-[#32CE7A]/20 text-[#32CE7A]'
                                : transfer.status === 'processing'
                                ? 'bg-blue-500/20 text-blue-400'
                                : transfer.status === 'pending' || transfer.status === 'retry_pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {transfer.status === 'succeeded'
                              ? 'Paid'
                              : transfer.status === 'processing'
                              ? 'Processing'
                              : transfer.status === 'pending'
                              ? 'Pending'
                              : transfer.status === 'retry_pending'
                              ? 'Retrying'
                              : 'Failed'}
                          </span>
                        ) : (
                          <span className="text-[#C6CFD9] text-xs">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {earningsData.length === 0 && (
            <div className="text-center py-12 text-[#C6CFD9]">
              No earnings yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

