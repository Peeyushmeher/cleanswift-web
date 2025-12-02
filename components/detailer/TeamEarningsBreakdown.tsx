'use client';

import { formatCurrency } from '@/lib/detailer/dashboard-utils';
import Link from 'next/link';

interface TeamEarnings {
  name: string;
  revenue: number;
  jobs: number;
}

interface TeamEarningsBreakdownProps {
  teams: TeamEarnings[];
}

export default function TeamEarningsBreakdown({ teams }: TeamEarningsBreakdownProps) {
  if (teams.length === 0) {
    return (
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Team Earnings Breakdown</h2>
        <p className="text-[#C6CFD9]">No team earnings data available</p>
      </div>
    );
  }

  const averagePerJob = teams.reduce((sum, t) => sum + (t.revenue / t.jobs || 0), 0) / teams.length;

  return (
    <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Team Earnings Breakdown</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Team
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Jobs
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Revenue
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase">
                Average
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {teams.map((team, idx) => (
              <tr key={idx} className="hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white font-medium">{team.name}</td>
                <td className="px-4 py-3 text-sm text-white">{team.jobs}</td>
                <td className="px-4 py-3 text-sm text-[#32CE7A] font-semibold">
                  {formatCurrency(team.revenue)}
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {formatCurrency(team.jobs > 0 ? team.revenue / team.jobs : 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

