import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function AdminRefundsPage() {
  const supabase = await createClient();

  // Get pending refunds
  const { data: refunds } = await supabase.rpc('get_pending_refunds');

  // Server actions
  async function processRefund(formData: FormData) {
    'use server';
    const refundId = formData.get('refund_id') as string;
    const action = formData.get('action') as string;
    const adminNotes = formData.get('admin_notes') as string;

    if (refundId && action) {
      const supabase = await createClient();
      
      await supabase.rpc('process_refund_request', {
        p_refund_request_id: refundId,
        p_action: action,
        p_admin_notes: adminNotes || null,
      });
      
      revalidatePath('/admin/finance/refunds');
    }
  }

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
        <h1 className="text-3xl font-bold text-white mb-2">Refund Requests</h1>
        <p className="text-[#C6CFD9]">Review and process pending refund requests</p>
      </div>

      {/* Pending Refunds */}
      {!refunds || refunds.length === 0 ? (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-white font-medium">No pending refund requests</p>
          <p className="text-sm text-[#C6CFD9] mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund: any) => (
            <div key={refund.id} className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-bold text-white">
                      ${(refund.amount_cents / 100).toFixed(2)}
                    </span>
                    <span className="px-2 py-1 rounded-md text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      Pending
                    </span>
                  </div>
                  <p className="text-[#C6CFD9]">
                    Booking #{refund.booking?.receipt_id} • Original amount: ${refund.booking?.total_amount}
                  </p>
                </div>
                <div className="text-right text-sm text-[#C6CFD9]">
                  <div>Requested {new Date(refund.created_at).toLocaleString()}</div>
                  <div>by {refund.requested_by?.full_name}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-[#050B12] rounded-lg">
                  <div className="text-sm text-[#C6CFD9] mb-1">Customer</div>
                  <div className="text-white">{refund.customer?.full_name}</div>
                  <div className="text-sm text-[#C6CFD9]">{refund.customer?.email}</div>
                </div>
                <div className="p-3 bg-[#050B12] rounded-lg">
                  <div className="text-sm text-[#C6CFD9] mb-1">Reason</div>
                  <div className="text-white">{refund.reason}</div>
                </div>
              </div>

              {/* Action Form */}
              <form action={processRefund} className="flex flex-wrap items-end gap-4">
                <input type="hidden" name="refund_id" value={refund.id} />
                
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm text-[#C6CFD9] mb-1 block">Admin Notes (optional)</label>
                  <input
                    type="text"
                    name="admin_notes"
                    placeholder="Add notes..."
                    className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="action"
                    value="approve"
                    className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
                  >
                    Approve Refund
                  </button>
                  <button
                    type="submit"
                    name="action"
                    value="deny"
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </form>

              {/* Stripe Link */}
              {refund.booking?.stripe_payment_intent_id && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <a
                    href={`https://dashboard.stripe.com/payments/${refund.booking.stripe_payment_intent_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#32CE7A] hover:text-[#6FF0C4] flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    View Payment in Stripe
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

