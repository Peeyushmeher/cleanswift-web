'use client';

import { formatCurrency, formatDate } from '@/lib/detailer/dashboard-utils';

interface WeeklyPayoutBatch {
  id: string;
  week_start_date: string;
  week_end_date: string;
  total_amount_cents: number;
  total_transfers: number;
  stripe_transfer_id: string | null;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface WeeklyPayoutSummaryProps {
  batches: WeeklyPayoutBatch[];
  pendingAmount: number;
  pendingCount: number;
}

export default function WeeklyPayoutSummary({ 
  batches, 
  pendingAmount, 
  pendingCount 
}: WeeklyPayoutSummaryProps) {
  // Calculate next payout date (next Wednesday)
  const getNextPayoutDate = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysUntilWednesday = dayOfWeek === 0 ? 3 : (3 - dayOfWeek + 7) % 7 || 7;
    const nextWednesday = new Date(now);
    nextWednesday.setDate(now.getDate() + daysUntilWednesday);
    nextWednesday.setHours(9, 0, 0, 0);
    return nextWednesday;
  };

  const nextPayoutDate = getNextPayoutDate();

  return (
    <div className="space-y-6">
      {/* Pending Weekly Payout */}
      {pendingAmount > 0 && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pending Weekly Payout</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[#C6CFD9]">Total Amount:</span>
              <span className="text-2xl font-bold text-[#32CE7A]">
                {formatCurrency(pendingAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#C6CFD9]">Number of Bookings:</span>
              <span className="text-white font-semibold">{pendingCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#C6CFD9]">Expected Payout Date:</span>
              <span className="text-white font-semibold">
                {formatDate(nextPayoutDate.toISOString(), 'short')} at 9:00 AM
              </span>
            </div>
            <div className="pt-4 border-t border-white/5">
              <p className="text-sm text-[#C6CFD9]">
                Your earnings from completed bookings are accumulated and paid out weekly on Wednesdays.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Payout History */}
      {batches.length > 0 && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Weekly Payout History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                    Week
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                    Bookings
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                    Processed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-white">
                      {formatDate(batch.week_start_date, 'short')} - {formatDate(batch.week_end_date, 'short')}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{batch.total_transfers}</td>
                    <td className="px-4 py-3 text-sm text-[#32CE7A] font-semibold">
                      {formatCurrency(batch.total_amount_cents / 100)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          batch.status === 'succeeded'
                            ? 'bg-[#32CE7A]/20 text-[#32CE7A]'
                            : batch.status === 'processing'
                            ? 'bg-blue-500/20 text-blue-400'
                            : batch.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {batch.status === 'succeeded'
                          ? 'Paid'
                          : batch.status === 'processing'
                          ? 'Processing'
                          : batch.status === 'pending'
                          ? 'Pending'
                          : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#C6CFD9]">
                      {batch.processed_at
                        ? formatDate(batch.processed_at, 'short')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {batches.length === 0 && pendingAmount === 0 && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Weekly Payouts</h2>
          <p className="text-[#C6CFD9]">No weekly payouts yet. Completed bookings will be paid out weekly on Wednesdays.</p>
        </div>
      )}
    </div>
  );
}

