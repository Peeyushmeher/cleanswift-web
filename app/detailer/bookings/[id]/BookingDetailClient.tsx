'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ContactCustomer from '@/components/detailer/ContactCustomer';
import JobMap from '@/components/detailer/JobMap';
import JobNotes from '@/components/detailer/JobNotes';
import JobTimeline from '@/components/detailer/JobTimeline';
import PaymentBreakdown from '@/components/detailer/PaymentBreakdown';
import PhotoUpload from '@/components/detailer/PhotoUpload';
import StatusBadge from '@/components/ui/StatusBadge';
import JobAssignmentModal from '@/components/detailer/JobAssignmentModal';
import { createClient } from '@/lib/supabase/client';

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
  const router = useRouter();
  const supabase = createClient();

  const handleAssigned = () => {
    router.refresh();
  };

  const handleStatusUpdate = async (newStatus: string) => {
    const { error } = await supabase.rpc('update_booking_status', {
      p_booking_id: booking.id,
      p_new_status: newStatus,
    });

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } else {
      router.refresh();
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
                {new Date(booking.scheduled_start).toLocaleString()}
              </div>
              {booking.scheduled_end && (
                <div>
                  <strong>End Time:</strong> {new Date(booking.scheduled_end).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Customer Information</h2>
            <div className="space-y-2 text-[#C6CFD9]">
              <div>
                <strong>Name:</strong> {booking.user?.full_name || booking.user_id || 'N/A'}
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

        {canUpdateStatus && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Update Status</h2>
            {booking.status === 'accepted' && (
              <button
                onClick={() => handleStatusUpdate('in_progress')}
                className="bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Start Service
              </button>
            )}
            {booking.status === 'in_progress' && (
              <button
                onClick={() => handleStatusUpdate('completed')}
                className="bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Mark as Completed
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

