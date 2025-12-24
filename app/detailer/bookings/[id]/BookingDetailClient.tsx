'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ContactCustomer from '@/components/detailer/ContactCustomer';
import JobMap from '@/components/detailer/JobMap';
import JobNotes from '@/components/detailer/JobNotes';
import JobTimeline from '@/components/detailer/JobTimeline';
import PaymentBreakdown from '@/components/detailer/PaymentBreakdown';
import PhotoUpload from '@/components/detailer/PhotoUpload';
import StatusBadge from '@/components/ui/StatusBadge';
import JobAssignmentModal from '@/components/detailer/JobAssignmentModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';
import { formatScheduledDateTime, formatScheduledTime } from '@/lib/detailer/dashboard-utils';

interface BookingDetailClientProps {
  booking: any;
  timeline: any[];
  notes: any[];
  photos: any[];
  canUpdateStatus: boolean;
  canReassign: boolean;
  organizationId?: string;
  platformFee?: number;
  platformFeePercentage?: number;
}

export default function BookingDetailClient({
  booking,
  timeline,
  notes,
  photos,
  canUpdateStatus,
  canReassign,
  organizationId,
  platformFee,
  platformFeePercentage = 15,
}: BookingDetailClientProps) {
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);
  const [transferStatus, setTransferStatus] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  // Fetch transfer status if booking is completed
  useEffect(() => {
    if (booking.status === 'completed') {
      const fetchTransferStatus = async () => {
        const { data, error } = await supabase
          .from('detailer_transfers')
          .select(`
            *,
            weekly_payout_batch:solo_weekly_payout_batches (
              id,
              week_start_date,
              week_end_date,
              status,
              processed_at
            )
          `)
          .eq('booking_id', booking.id)
          .single();

        if (!error && data) {
          setTransferStatus(data);
        }
      };
      fetchTransferStatus();
    }
  }, [booking.id, booking.status, supabase]);

  const handleAssigned = () => {
    router.refresh();
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setStatusUpdateLoading(true);
    setStatusUpdateError(null);
    setStatusUpdateSuccess(false);

    try {
      // First, verify the detailer assignment before calling RPC
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatusUpdateError('Not authenticated. Please sign in again.');
        setStatusUpdateLoading(false);
        return;
      }

      // Get current user's detailer record
      const { data: detailerRecord, error: detailerError } = await supabase
        .from('detailers')
        .select('id, profile_id')
        .eq('profile_id', user.id)
        .single();

      if (detailerError || !detailerRecord) {
        console.error('Error getting detailer record:', detailerError);
        setStatusUpdateError('Unable to verify detailer assignment. Please contact support.');
        setStatusUpdateLoading(false);
        return;
      }

      // Verify booking is assigned to this detailer
      if (booking.detailer_id !== detailerRecord.id) {
        setStatusUpdateError(
          `This booking is not assigned to you. Booking detailer_id: ${booking.detailer_id}, Your detailer_id: ${detailerRecord.id}`
        );
        setStatusUpdateLoading(false);
        return;
      }

      // Now call the RPC function
      const { data, error } = await supabase.rpc('update_booking_status', {
        p_booking_id: booking.id,
        p_new_status: newStatus,
      });

      if (error) {
        console.error('Error updating status:', error);
        // Extract user-friendly error message
        let errorMessage = 'Failed to update status';
        
        // Check for specific error messages
        if (error.message) {
          errorMessage = error.message;
          // If it's the detailer assignment error, provide more context
          if (error.message.includes('Detailer not assigned')) {
            errorMessage = `Unable to update status: This booking may not be properly assigned to your account. Please contact support if this booking should be assigned to you.`;
          }
        } else if (error.details) {
          errorMessage = error.details;
        } else if (error.hint) {
          errorMessage = error.hint;
        }
        
        setStatusUpdateError(errorMessage);
        setStatusUpdateLoading(false);
      } else {
        setStatusUpdateSuccess(true);
        // Refresh after a short delay to show success message
        setTimeout(() => {
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      setStatusUpdateError(err?.message || 'An unexpected error occurred');
      setStatusUpdateLoading(false);
    }
  };

  const handleCompleteService = () => {
    if (confirm('Are you sure you want to mark this service as completed? This will initiate the payment transfer.')) {
      handleStatusUpdate('completed');
    }
  };

  return (
    <>
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {booking.car?.make} {booking.car?.model} {booking.car?.year}
            </h1>
            <p className="text-[#C6CFD9]">Booking #{booking.receipt_id}</p>
            {canReassign && booking.detailer && (
              <p className="text-sm text-[#C6CFD9] mt-1">
                Assigned to: <span className="text-[#32CE7A]">{booking.detailer.full_name}</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#32CE7A] mb-2">
              ${booking.service?.price || booking.total_amount || 0}
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </div>

        {canReassign && (
          <div className="mb-6">
            <button
              onClick={() => setAssignmentModalOpen(true)}
              className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors"
            >
              {booking.detailer_id ? 'Reassign Job' : 'Assign Job'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Service Details</h2>
            <div className="space-y-2 text-[#C6CFD9]">
              <div>
                <strong>Service:</strong> {booking.service?.name}
              </div>
              <div>
                <strong>Description:</strong> {booking.service?.description || 'N/A'}
              </div>
              <div>
                <strong>Scheduled:</strong>{' '}
                {booking.scheduled_date && booking.scheduled_time_start
                  ? formatScheduledDateTime(booking.scheduled_date, booking.scheduled_time_start)
                  : booking.scheduled_start
                  ? new Date(booking.scheduled_start).toLocaleString()
                  : 'Not scheduled'}
              </div>
              {booking.scheduled_time_end && (
                <div>
                  <strong>End Time:</strong> {formatScheduledTime(booking.scheduled_time_end)}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Customer Information</h2>
            <div className="space-y-2 text-[#C6CFD9]">
              <div>
                <strong>Name:</strong> {booking.user?.full_name || 'N/A'}
              </div>
              <div>
                <strong>Phone:</strong> {booking.user?.phone || 'N/A'}
              </div>
              <div>
                <strong>Email:</strong> {booking.user?.email || 'N/A'}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Vehicle Information</h2>
            <div className="space-y-2 text-[#C6CFD9]">
              <div>
                <strong>Make/Model:</strong> {booking.car?.make && booking.car?.model 
                  ? `${booking.car.make} ${booking.car.model}` 
                  : 'N/A'}
              </div>
              <div>
                <strong>Year:</strong> {booking.car?.year || 'N/A'}
              </div>
              <div>
                <strong>License Plate:</strong> {booking.car?.license_plate || 'N/A'}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Location</h2>
            <JobMap
              address={booking.address_line1 || ''}
              latitude={booking.latitude}
              longitude={booking.longitude}
              city={booking.city}
              province={booking.province}
            />
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <PaymentBreakdown
            servicePrice={booking.service_price || booking.service?.price || 0}
            addonsTotal={booking.addons_total || 0}
            taxAmount={booking.tax_amount || 0}
            totalAmount={booking.total_amount || 0}
            platformFee={platformFee}
            platformFeePercentage={platformFeePercentage}
            stripeProcessingFee={booking.stripe_processing_fee || 0}
            stripeConnectFee={booking.stripe_connect_fee || 0}
          />
        </div>

        {/* Job Timeline */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <JobTimeline
            timeline={timeline}
            currentStatus={booking.status}
            createdAt={booking.created_at}
          />
        </div>

        {/* Photos */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <PhotoUpload bookingId={booking.id} initialPhotos={photos} />
        </div>

        {/* Notes */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <JobNotes bookingId={booking.id} initialNotes={notes} />
        </div>

        {/* Contact Customer */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Contact Customer</h2>
          <ContactCustomer phone={booking.user?.phone} />
        </div>

        {/* Accept Offer Button */}
        {booking.status === 'offered' && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Accept Offer</h2>
            <p className="text-[#C6CFD9] mb-4">
              This job has been offered to you. Accept it to add it to your schedule.
            </p>
            <button
              onClick={async () => {
                try {
                  // For "offered" bookings that are already assigned, we need to use accept_booking
                  // But accept_booking requires detailer_id to be NULL, so we need a different approach
                  // Let's use a direct update that bypasses the RPC check for this specific case
                  
                  // First, get the current user's detailer record ID
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert('Not authenticated');
                    return;
                  }

                  const { data: detailerRecord } = await supabase
                    .from('detailers')
                    .select('id')
                    .eq('profile_id', user.id)
                    .single();

                  if (!detailerRecord) {
                    alert('Detailer record not found');
                    return;
                  }

                  // Check if booking is assigned to this detailer
                  if (booking.detailer_id !== detailerRecord.id) {
                    alert('This booking is not assigned to you');
                    return;
                  }

                  // Update status directly (since we've verified access)
                  const { error } = await supabase
                    .from('bookings')
                    .update({ 
                      status: 'accepted',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', booking.id)
                    .eq('detailer_id', detailerRecord.id);

                  if (error) {
                    console.error('Error accepting booking:', error);
                    alert(`Failed to accept booking: ${error.message}`);
                  } else {
                    alert('Booking accepted! It will now appear in your schedule.');
                    router.refresh();
                  }
                } catch (err) {
                  console.error('Error accepting booking:', err);
                  alert('Failed to accept booking. Please try again.');
                }
              }}
              className="bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
            >
              Accept Offer
            </button>
          </div>
        )}

        {/* Transfer Status Display (for completed bookings) */}
        {booking.status === 'completed' && transferStatus && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Payment Transfer</h2>
            <div className="bg-[#050B12] border border-white/10 rounded-lg p-4">
              <div className="space-y-2 text-[#C6CFD9]">
                <div className="flex justify-between">
                  <span>Transfer Amount:</span>
                  <span className="text-white font-semibold">
                    ${(transferStatus.amount_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-semibold ${
                    transferStatus.status === 'succeeded' ? 'text-[#32CE7A]' :
                    transferStatus.status === 'processing' ? 'text-yellow-400' :
                    transferStatus.status === 'failed' ? 'text-red-400' :
                    'text-[#C6CFD9]'
                  }`}>
                    {transferStatus.status === 'pending' && !transferStatus.weekly_payout_batch_id
                      ? 'Pending Weekly Batch'
                      : transferStatus.status === 'processing' && transferStatus.weekly_payout_batch_id
                      ? 'Processing in Weekly Batch'
                      : transferStatus.status.charAt(0).toUpperCase() + transferStatus.status.slice(1)}
                  </span>
                </div>
                {transferStatus.weekly_payout_batch_id && transferStatus.weekly_payout_batch && (
                  <div className="text-sm text-[#C6CFD9] mt-2 space-y-1">
                    <div>
                      Weekly Batch: {new Date(transferStatus.weekly_payout_batch.week_start_date).toLocaleDateString()} - {new Date(transferStatus.weekly_payout_batch.week_end_date).toLocaleDateString()}
                    </div>
                    <div>
                      Batch Status: <span className={`${
                        transferStatus.weekly_payout_batch.status === 'succeeded' ? 'text-[#32CE7A]' :
                        transferStatus.weekly_payout_batch.status === 'processing' ? 'text-yellow-400' :
                        transferStatus.weekly_payout_batch.status === 'failed' ? 'text-red-400' :
                        'text-[#C6CFD9]'
                      }`}>
                        {transferStatus.weekly_payout_batch.status.charAt(0).toUpperCase() + transferStatus.weekly_payout_batch.status.slice(1)}
                      </span>
                    </div>
                  </div>
                )}
                {!transferStatus.weekly_payout_batch_id && transferStatus.status === 'pending' && (
                  <div className="text-sm text-[#C6CFD9] mt-2">
                    This transfer will be included in the next weekly payout (Wednesdays).
                  </div>
                )}
                {transferStatus.stripe_transfer_id && (
                  <div className="text-sm text-[#C6CFD9] mt-2">
                    Stripe Transfer ID: {transferStatus.stripe_transfer_id}
                  </div>
                )}
                {transferStatus.error_message && (
                  <div className="text-sm text-red-400 mt-2">
                    Error: {transferStatus.error_message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transfer Status Display (for completed bookings without transfer) */}
        {booking.status === 'completed' && !transferStatus && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Payment Transfer</h2>
            <div className="bg-[#050B12] border border-white/10 rounded-lg p-4">
              <p className="text-[#C6CFD9]">
                Transfer information will be available once the payment is processed. 
                Transfers are processed weekly on Wednesdays.
              </p>
            </div>
          </div>
        )}

        {/* Update Status Section */}
        {canUpdateStatus && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Update Status</h2>
            
            {/* Error Message */}
            {statusUpdateError && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{statusUpdateError}</p>
              </div>
            )}

            {/* Success Message */}
            {statusUpdateSuccess && (
              <div className="mb-4 p-4 bg-[#32CE7A]/10 border border-[#32CE7A]/20 rounded-lg">
                <p className="text-[#32CE7A] text-sm">
                  Status updated successfully! {booking.status === 'completed' && 'Payment transfer has been initiated.'}
                </p>
              </div>
            )}

            {/* Status Update Buttons */}
            {booking.status === 'accepted' && (
              <button
                onClick={() => handleStatusUpdate('in_progress')}
                disabled={statusUpdateLoading}
                className="bg-[#32CE7A] hover:bg-[#2AB869] disabled:bg-[#32CE7A]/50 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                {statusUpdateLoading && <LoadingSpinner size="sm" />}
                Start Service
              </button>
            )}
            {booking.status === 'in_progress' && (
              <button
                onClick={handleCompleteService}
                disabled={statusUpdateLoading}
                className="bg-[#32CE7A] hover:bg-[#2AB869] disabled:bg-[#32CE7A]/50 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                {statusUpdateLoading && <LoadingSpinner size="sm" />}
                Complete Service
              </button>
            )}
          </div>
        )}
      </div>

      {canReassign && organizationId && (
        <JobAssignmentModal
          isOpen={assignmentModalOpen}
          onClose={() => setAssignmentModalOpen(false)}
          bookingId={booking.id}
          organizationId={organizationId}
          currentDetailerId={booking.detailer_id}
          onAssigned={handleAssigned}
        />
      )}
    </>
  );
}

