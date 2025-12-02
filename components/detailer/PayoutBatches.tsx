'use client';

import { formatCurrency, formatDate } from '@/lib/detailer/dashboard-utils';

interface PayoutBatch {
  id: string;
  batch_date: string;
  total_jobs: number;
  total_amount: number;
  stripe_payout_id: string | null;
  created_at: string;
}

interface PayoutBatchesProps {
  batches: PayoutBatch[];
}

export default function PayoutBatches({ batches }: PayoutBatchesProps) {
  if (batches.length === 0) {
    return (
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Payout Batches</h2>
        <p className="text-[#C6CFD9]">No payout batches yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Payout Batches</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Jobs
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {batches.map((batch) => (
              <tr key={batch.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">
                  {formatDate(batch.batch_date, 'short')}
                </td>
                <td className="px-4 py-3 text-sm text-white">{batch.total_jobs}</td>
                <td className="px-4 py-3 text-sm text-[#32CE7A] font-semibold">
                  {formatCurrency(batch.total_amount)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      batch.stripe_payout_id
                        ? 'bg-[#32CE7A]/20 text-[#32CE7A]'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {batch.stripe_payout_id ? 'Paid' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

