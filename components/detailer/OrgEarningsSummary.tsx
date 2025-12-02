'use client';

import { formatCurrency } from '@/lib/detailer/dashboard-utils';

interface OrgEarningsSummaryProps {
  grossRevenue: number;
  netRevenue: number;
  platformFee: number;
  totalJobs: number;
}

export default function OrgEarningsSummary({
  grossRevenue,
  netRevenue,
  platformFee,
  totalJobs,
}: OrgEarningsSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <div className="text-[#C6CFD9] text-sm mb-2">Gross Revenue</div>
        <div className="text-3xl font-bold text-white">{formatCurrency(grossRevenue)}</div>
      </div>
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <div className="text-[#C6CFD9] text-sm mb-2">Net Revenue</div>
        <div className="text-3xl font-bold text-[#32CE7A]">{formatCurrency(netRevenue)}</div>
      </div>
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <div className="text-[#C6CFD9] text-sm mb-2">Platform Fee</div>
        <div className="text-3xl font-bold text-yellow-400">{formatCurrency(platformFee)}</div>
      </div>
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <div className="text-[#C6CFD9] text-sm mb-2">Total Jobs</div>
        <div className="text-3xl font-bold text-white">{totalJobs}</div>
      </div>
    </div>
  );
}

