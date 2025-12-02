import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AdminPayoutsPage() {
  const supabase = await createClient();

  // Get all payouts
  const { data: payouts } = await supabase.rpc('get_all_payouts', {
    p_limit: 100,
    p_offset: 0,
  });

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/finance"
          className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Finance
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Payouts</h1>
        <p className="text-[#C6CFD9]">Track organization and detailer payouts</p>
      </div>

      {/* Payouts Table */}
      {!payouts || payouts.length === 0 ? (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#C6CFD9] opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          <p className="text-[#C6CFD9]">No payouts recorded yet</p>
          <p className="text-sm text-[#C6CFD9]/60 mt-2">Payouts will appear here once organizations start receiving payments</p>
        </div>
      ) : (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050B12] border-b border-white/10">
                <tr>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Batch Date</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Organization</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Jobs</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Total Amount</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Stripe Payout</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout: any) => (
                  <tr key={payout.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-white text-sm">
                      {new Date(payout.batch_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-white text-sm">
                      {payout.organization?.name}
                    </td>
                    <td className="py-3 px-4 text-white text-sm">
                      {payout.total_jobs}
                    </td>
                    <td className="py-3 px-4 text-[#32CE7A] font-medium">
                      ${payout.total_amount}
                    </td>
                    <td className="py-3 px-4">
                      {payout.stripe_payout_id ? (
                        <a
                          href={`https://dashboard.stripe.com/payouts/${payout.stripe_payout_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#32CE7A] hover:text-[#6FF0C4]"
                        >
                          View in Stripe
                        </a>
                      ) : (
                        <span className="text-[#C6CFD9] text-sm">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/organizations/${payout.organization?.id}`}
                        className="text-sm text-[#32CE7A] hover:text-[#6FF0C4]"
                      >
                        View Org
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

