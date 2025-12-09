'use client';

import { formatCurrency, formatDate } from '@/lib/detailer/dashboard-utils';

interface Transfer {
  id: string;
  booking_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  stripe_transfer_id: string | null;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'retry_pending';
  error_message: string | null;
  retry_count: number;
  created_at: string;
  booking?: {
    id: string;
    receipt_id: string;
    total_amount: number;
    completed_at: string;
    service?: { name: string };
  };
}

interface TransferStats {
  totalTransferred: number;
  pendingTransfers: number;
  failedTransfers: number;
}

interface TransferHistoryProps {
  transfers: Transfer[];
  stats: TransferStats;
}

function getStatusBadge(status: Transfer['status']) {
  switch (status) {
    case 'succeeded':
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-[#32CE7A]/20 text-[#32CE7A]">
          Succeeded
        </span>
      );
    case 'processing':
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
          Processing
        </span>
      );
    case 'pending':
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
          Pending
        </span>
      );
    case 'retry_pending':
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-400">
          Retry Pending
        </span>
      );
    case 'failed':
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">
          Failed
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-[#C6CFD9]/20 text-[#C6CFD9]">
          Unknown
        </span>
      );
  }
}

export default function TransferHistory({ transfers, stats }: TransferHistoryProps) {
  if (transfers.length === 0) {
    return (
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Transfer History</h2>
        <p className="text-[#C6CFD9]">No transfers yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="text-[#C6CFD9] text-sm mb-2">Total Transferred</div>
          <div className="text-2xl font-bold text-[#32CE7A]">
            {formatCurrency(stats.totalTransferred)}
          </div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="text-[#C6CFD9] text-sm mb-2">Pending Transfers</div>
          <div className="text-2xl font-bold text-yellow-400">
            {formatCurrency(stats.pendingTransfers)}
          </div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <div className="text-[#C6CFD9] text-sm mb-2">Failed Transfers</div>
          <div className="text-2xl font-bold text-red-400">
            {stats.failedTransfers}
          </div>
        </div>
      </div>

      {/* Transfer Table */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Transfer History</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Booking ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                  Stripe ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transfers.map((transfer) => {
                const booking = Array.isArray(transfer.booking) 
                  ? transfer.booking[0] 
                  : transfer.booking;
                const amount = transfer.amount_cents / 100;
                
                return (
                  <tr key={transfer.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-white">
                      {formatDate(transfer.created_at, 'short')}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#C6CFD9] font-mono">
                      {booking?.receipt_id || transfer.booking_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {booking?.service?.name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#32CE7A] font-semibold">
                      {formatCurrency(amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(transfer.status)}
                      {transfer.error_message && (
                        <div className="text-xs text-red-400 mt-1">
                          {transfer.error_message}
                        </div>
                      )}
                      {transfer.retry_count > 0 && (
                        <div className="text-xs text-[#C6CFD9] mt-1">
                          Retries: {transfer.retry_count}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {transfer.stripe_transfer_id ? (
                        <a
                          href={`https://dashboard.stripe.com/transfers/${transfer.stripe_transfer_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#32CE7A] hover:text-[#6FF0C4] underline text-xs"
                        >
                          {transfer.stripe_transfer_id.slice(0, 20)}...
                        </a>
                      ) : (
                        <span className="text-[#C6CFD9] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

