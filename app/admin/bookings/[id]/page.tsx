import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

// Status badge component
function StatusBadge({ status, large = false }: { status: string; large?: boolean }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    requires_payment: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    offered: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    accepted: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    completed: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    no_show: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <span className={`${large ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'} rounded-md font-medium border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function PaymentBadge({ status, large = false }: { status: string; large?: boolean }) {
  const colors: Record<string, string> = {
    unpaid: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    requires_payment: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paid: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
    refunded: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`${large ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'} rounded-md font-medium border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get booking details with related data
  const { data: bookingRaw, error } = await supabase
    .from('bookings')
    .select(`
      *,
      service:services(id, name, price, duration_minutes, description),
      detailer:detailers(id, full_name, rating, avatar_url),
      car:cars(id, make, model, year, color, license_plate),
      customer:profiles!bookings_user_id_fkey(id, full_name, email, phone)
    `)
    .eq('id', id)
    .single();

  if (error || !bookingRaw) {
    console.error('Error fetching booking:', error);
    notFound();
  }

  // Get booking addons
  const { data: bookingAddons } = await supabase
    .from('booking_addons')
    .select(`
      id,
      price,
      addon:service_addons(id, name, description)
    `)
    .eq('booking_id', id);

  // Transform data to match template expectations
  const booking = {
    ...bookingRaw,
    address: {
      address_line1: bookingRaw.address_line1,
      address_line2: bookingRaw.address_line2,
      city: bookingRaw.city,
      province: bookingRaw.province,
      postal_code: bookingRaw.postal_code,
      latitude: bookingRaw.latitude || bookingRaw.location_lat,
      longitude: bookingRaw.longitude || bookingRaw.location_lng,
    },
    addons: bookingAddons?.map(ba => {
      const addon = Array.isArray(ba.addon) ? ba.addon[0] : ba.addon;
      return {
        id: ba.id,
        name: addon?.name,
        description: addon?.description,
        price: ba.price,
      };
    }) || [],
    notes: [], // Would need a booking_notes table
    audit_logs: [], // Would need to query admin_action_logs
  };

  // Get all detailers for assignment dropdown (including inactive for reference)
  const { data: allDetailers } = await supabase
    .from('detailers')
    .select('id, full_name, rating, is_active')
    .order('full_name');
  
  // Filter to active detailers for the dropdown
  const detailers = allDetailers?.filter((d: any) => d.is_active) || [];

  // Server actions
  async function assignDetailer(formData: FormData) {
    'use server';
    const detailerId = formData.get('detailer_id') as string;
    if (!detailerId) {
      return;
    }

    const supabase = await createClient();
    
    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Not authenticated');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      console.error('Only admins can assign detailers');
      return;
    }

    const { error: assignError } = await supabase.rpc('assign_detailer_to_booking', {
      p_booking_id: id,
      p_detailer_id: detailerId,
    });

    if (assignError) {
      console.error('Error assigning detailer:', assignError);
      return;
    }

    // Log admin action (non-blocking)
    try {
      await supabase.rpc('log_admin_action', {
        p_action_type: 'assign_detailer',
        p_entity_type: 'booking',
        p_entity_id: id,
        p_metadata: { detailer_id: detailerId },
      });
    } catch (err) {
      console.error('Error logging admin action:', err);
    }

    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath('/admin/bookings');
  }

  async function updateStatus(formData: FormData) {
    'use server';
    const newStatus = formData.get('status') as string;
    if (!newStatus) {
      return;
    }

    const supabase = await createClient();
    
    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Not authenticated');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      console.error('Only admins can update booking status');
      return;
    }

    const { error: updateError } = await supabase.rpc('update_booking_status', {
      p_booking_id: id,
      p_new_status: newStatus,
    });

    if (updateError) {
      console.error('Error updating booking status:', updateError);
      return;
    }

    // Log admin action (non-blocking)
    try {
      await supabase.rpc('log_admin_action', {
        p_action_type: 'update_status',
        p_entity_type: 'booking',
        p_entity_id: id,
        p_metadata: { new_status: newStatus },
      });
    } catch (err) {
      console.error('Error logging admin action:', err);
    }

    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath('/admin/bookings');
  }

  async function addNote(formData: FormData) {
    'use server';
    const note = formData.get('note') as string;
    if (note?.trim()) {
      const supabase = await createClient();
      await supabase.rpc('add_booking_note', {
        p_booking_id: id,
        p_note: note,
        p_is_internal: true,
      });
      revalidatePath(`/admin/bookings/${id}`);
    }
  }

  async function requestRefund(formData: FormData) {
    'use server';
    const reason = formData.get('reason') as string;
    const amountStr = formData.get('amount') as string;
    const amount = parseFloat(amountStr) * 100; // Convert to cents
    
    if (reason?.trim() && amount > 0) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create refund request
      await supabase.from('refund_requests').insert({
        booking_id: id,
        requested_by: user?.id,
        amount_cents: amount,
        reason: reason,
        status: 'pending',
      });
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'request_refund',
        p_entity_type: 'booking',
        p_entity_id: id,
        p_metadata: { amount_cents: amount, reason },
      });
      
      revalidatePath(`/admin/bookings/${id}`);
    }
  }

  // Calculate platform fee using detailer's pricing model
  const { calculatePlatformFee, calculateDetailerPayout } = await import('@/lib/platform-settings');
  const detailerId = bookingRaw.detailer_id;
  const totalAmount = parseFloat(booking.total_amount || '0');
  const platformFee = await calculatePlatformFee(totalAmount, undefined, detailerId);
  const detailerPayout = await calculateDetailerPayout(totalAmount, undefined, detailerId);
  const platformFeePercent = totalAmount > 0 ? (platformFee / totalAmount) * 100 : 0;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/bookings"
          className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Bookings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Booking #{booking.receipt_id}</h1>
            <div className="flex items-center gap-3">
              <StatusBadge status={booking.status} large />
              <PaymentBadge status={booking.payment_status} large />
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#32CE7A]">${booking.total_amount}</div>
            <div className="text-sm text-[#C6CFD9]">Total Amount</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="xl:col-span-2 space-y-6">
          {/* Customer & Service Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer */}
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                Customer
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-white font-medium">{booking.customer?.full_name}</div>
                </div>
                <div className="flex items-center gap-2 text-[#C6CFD9]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <span className="text-sm">{booking.customer?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[#C6CFD9]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  <span className="text-sm">{booking.customer?.phone}</span>
                </div>
                <Link
                  href={`/admin/customers/${booking.customer?.id}`}
                  className="text-sm text-[#32CE7A] hover:text-[#6FF0C4] transition-colors"
                >
                  View Customer Profile →
                </Link>
              </div>
            </div>

            {/* Car */}
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
                Vehicle
              </h2>
              <div className="space-y-2">
                <div className="text-white font-medium">
                  {booking.car?.year} {booking.car?.make} {booking.car?.model}
                </div>
                {booking.car?.color && (
                  <div className="text-sm text-[#C6CFD9]">Color: {booking.car.color}</div>
                )}
                <div className="text-sm text-[#C6CFD9]">
                  License: {booking.car?.license_plate}
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              Location
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-white">{booking.address?.address_line1}</div>
                {booking.address?.address_line2 && (
                  <div className="text-[#C6CFD9]">{booking.address.address_line2}</div>
                )}
                <div className="text-[#C6CFD9]">
                  {booking.address?.city}, {booking.address?.province} {booking.address?.postal_code}
                </div>
                {booking.location_notes && (
                  <div className="mt-2 text-sm text-[#C6CFD9] italic">
                    Notes: {booking.location_notes}
                  </div>
                )}
              </div>
              {booking.address?.latitude && booking.address?.longitude && (
                <div className="h-40 bg-[#050B12] rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${booking.address.latitude},${booking.address.longitude}&zoom=15`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Service & Price Breakdown */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
              </svg>
              Service & Pricing
            </h2>
            <div className="space-y-4">
              {/* Main Service */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-white font-medium">{booking.service?.name}</div>
                  <div className="text-sm text-[#C6CFD9]">{booking.service?.description}</div>
                  {booking.service?.duration_minutes && (
                    <div className="text-xs text-[#C6CFD9]">Duration: {booking.service.duration_minutes} min</div>
                  )}
                </div>
                <div className="text-white font-medium">${booking.service_price}</div>
              </div>

              {/* Add-ons */}
              {booking.addons && booking.addons.length > 0 && (
                <div className="border-t border-white/5 pt-4">
                  <div className="text-sm text-[#C6CFD9] mb-2">Add-ons:</div>
                  {booking.addons.map((addon: any) => (
                    <div key={addon.id} className="flex justify-between items-center py-1">
                      <span className="text-white">{addon.name}</span>
                      <span className="text-white">${addon.price}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Price Breakdown */}
              <div className="border-t border-white/5 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#C6CFD9]">Subtotal</span>
                  <span className="text-white">${(parseFloat(booking.service_price) + parseFloat(booking.addons_total || 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#C6CFD9]">Tax</span>
                  <span className="text-white">${booking.tax_amount}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t border-white/5">
                  <span className="text-white">Total</span>
                  <span className="text-[#32CE7A]">${booking.total_amount}</span>
                </div>
              </div>

              {/* Platform Split */}
              <div className="bg-[#050B12] rounded-lg p-4 mt-4">
                <div className="text-sm text-[#C6CFD9] mb-2">Platform Split</div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#C6CFD9]">Platform Fee ({platformFeePercent}%)</span>
                  <span className="text-white">${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#C6CFD9]">Detailer Payout</span>
                  <span className="text-[#32CE7A]">${detailerPayout.toFixed(2)}</span>
                </div>
              </div>

              {/* Stripe Link */}
              {booking.stripe_payment_intent_id && (
                <div className="pt-4">
                  <a
                    href={`https://dashboard.stripe.com/payments/${booking.stripe_payment_intent_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#32CE7A] hover:text-[#6FF0C4] flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    View in Stripe Dashboard
                  </a>
                  <div className="text-xs text-[#C6CFD9] mt-1 font-mono">{booking.stripe_payment_intent_id}</div>
                </div>
              )}
            </div>
          </div>

          {/* Internal Notes */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Internal Notes
            </h2>

            {/* Add Note Form */}
            <form action={addNote} className="mb-4">
              <textarea
                name="note"
                placeholder="Add an internal note..."
                className="w-full px-4 py-3 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50 resize-none"
                rows={3}
              />
              <button
                type="submit"
                className="mt-2 px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
              >
                Add Note
              </button>
            </form>

            {/* Notes List */}
            <div className="space-y-3">
              {booking.notes && booking.notes.length > 0 ? (
                booking.notes.map((note: any) => (
                  <div key={note.id} className="bg-[#050B12] rounded-lg p-3">
                    <p className="text-white text-sm">{note.note}</p>
                    <div className="mt-2 text-xs text-[#C6CFD9]">
                      {note.admin?.full_name} • {new Date(note.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[#C6CFD9] text-sm">No notes yet</p>
              )}
            </div>
          </div>

          {/* Audit Log */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Audit Log
            </h2>
            <div className="space-y-3">
              {booking.audit_logs && booking.audit_logs.length > 0 ? (
                booking.audit_logs.map((log: any) => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 mt-2 rounded-full bg-[#32CE7A] flex-shrink-0" />
                    <div>
                      <span className="text-white">{log.action_type.replace('_', ' ')}</span>
                      <span className="text-[#C6CFD9]"> by {log.admin_name}</span>
                      <div className="text-xs text-[#C6CFD9]/60">{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[#C6CFD9] text-sm">No admin actions recorded</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          {/* Schedule Info */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Schedule</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#C6CFD9]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <span className="text-white">{new Date(booking.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#C6CFD9]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-white">{booking.scheduled_time_start?.slice(0, 5)} - {booking.scheduled_time_end?.slice(0, 5) || 'TBD'}</span>
              </div>
              <div className="text-xs text-[#C6CFD9]">
                Created: {new Date(booking.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Detailer Assignment */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Detailer</h2>
            {booking.detailer ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#32CE7A]/20 flex items-center justify-center">
                    <span className="text-[#32CE7A] font-semibold">
                      {booking.detailer.full_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-medium">{booking.detailer.full_name}</div>
                    <div className="text-sm text-[#C6CFD9]">Rating: {booking.detailer.rating || 'N/A'}</div>
                  </div>
                </div>
                {booking.detailer.phone && (
                  <div className="text-sm text-[#C6CFD9]">{booking.detailer.phone}</div>
                )}
                <form action={assignDetailer} className="pt-2">
                  <select
                    name="detailer_id"
                    required
                    className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50 text-sm"
                  >
                    <option value="">Reassign to...</option>
                    {detailers?.filter((d: any) => d.id !== booking.detailer?.id && d.is_active).map((d: any) => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="w-full mt-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors text-sm font-medium"
                  >
                    Reassign Detailer
                  </button>
                </form>
              </div>
            ) : (
              <form action={assignDetailer} className="space-y-3">
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <span className="text-orange-400 text-sm font-medium">No detailer assigned</span>
                </div>
                <select
                  name="detailer_id"
                  required
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                >
                  <option value="">Select a detailer</option>
                  {detailers?.filter((d: any) => d.is_active).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
                >
                  Assign Detailer
                </button>
              </form>
            )}
          </div>

          {/* Update Status */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Update Status</h2>
            <form action={updateStatus} className="space-y-3">
              <select
                name="status"
                defaultValue={booking.status}
                required
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              >
                <option value="pending">Pending</option>
                <option value="requires_payment">Requires Payment</option>
                <option value="paid">Paid</option>
                <option value="offered">Offered</option>
                <option value="accepted">Accepted</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
              >
                Update Status
              </button>
            </form>
          </div>

          {/* Refund Request */}
          {booking.payment_status === 'paid' && (
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Issue Refund</h2>
              {booking.refund_requests && booking.refund_requests.length > 0 ? (
                <div className="space-y-3">
                  {booking.refund_requests.map((req: any) => (
                    <div key={req.id} className="p-3 bg-[#050B12] rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-medium">${(req.amount_cents / 100).toFixed(2)}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          req.status === 'processed' ? 'bg-[#32CE7A]/20 text-[#32CE7A]' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="text-sm text-[#C6CFD9]">{req.reason}</div>
                      <div className="text-xs text-[#C6CFD9]/60 mt-1">{new Date(req.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <form action={requestRefund} className="space-y-3">
                  <div>
                    <label className="text-sm text-[#C6CFD9] mb-1 block">Amount ($)</label>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      max={booking.total_amount}
                      defaultValue={booking.total_amount}
                      className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#C6CFD9] mb-1 block">Reason</label>
                    <textarea
                      name="reason"
                      required
                      placeholder="Reason for refund..."
                      className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50 resize-none"
                      rows={2}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                  >
                    Request Refund
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
