import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canAssignJobs } from '@/lib/detailer/permissions';
import { createClient } from '@/lib/supabase/server';
import { getPlatformFeePercentage, calculatePlatformFee } from '@/lib/platform-settings';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BookingDetailClient from './BookingDetailClient';

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireDetailer();
  const supabase = await createClient();
  const mode = await getDetailerMode();
  const organization = mode === 'organization' ? await getDetailerOrganization() : null;
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;

  // Get detailer record
  const { data: detailerData, error: detailerError } = await supabase.rpc('get_detailer_by_profile', {
    p_profile_id: null,
  });

  if (detailerError) {
    console.error('Error getting detailer:', detailerError);
  }

  // First, fetch the booking to check if it exists (using regular client for RLS)
  const { data: bookingCheck, error: bookingCheckError } = await supabase
    .from('bookings')
    .select('id, detailer_id, organization_id, status')
    .eq('id', id)
    .single();

  if (bookingCheckError || !bookingCheck) {
    notFound();
  }

  // Apply access control
  let hasAccess = false;

  if (mode === 'organization' && organization && orgRole && canAssignJobs(orgRole)) {
    // Org managers/dispatchers/owners can see any org booking
    hasAccess = bookingCheck.organization_id === organization.id;
  } else if (detailerData?.id) {
    // Solo or detailer in org: only see own bookings (including offered ones)
    hasAccess = bookingCheck.detailer_id === detailerData.id;
  } else {
    // Fallback: check if booking is assigned to current user's detailer record
    const { data: detailerFallback } = await supabase
      .from('detailers')
      .select('id')
      .eq('profile_id', profile.id)
      .single();
    
    hasAccess = detailerFallback?.id === bookingCheck.detailer_id;
  }

  if (!hasAccess) {
    notFound();
  }

  // Fetch full booking data with related tables
  // We've already verified access above, so RLS will allow this query
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      service:service_id (
        id,
        name,
        price,
        duration_minutes,
        description
      ),
      car:car_id (
        id,
        make,
        model,
        year,
        license_plate
      ),
      user:user_id (
        id,
        full_name,
        phone,
        email
      ),
      detailer:detailers (
        id,
        full_name
      ),
      team:teams (
        id,
        name
      )
    `
    )
    .eq('id', id)
    .single();

  if (error || !booking) {
    console.error('Booking query error:', error);
    notFound();
  }

  // Get booking timeline
  const { data: timeline } = await supabase
    .from('booking_timeline')
    .select('*')
    .eq('booking_id', id)
    .order('changed_at', { ascending: true });

  // Get booking notes
  const { data: notes } = await supabase
    .from('booking_notes')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });

  // Get job photos
  const { data: photos } = await supabase
    .from('job_photos')
    .select('*')
    .eq('booking_id', id)
    .order('uploaded_at', { ascending: false });

  const canUpdateStatus =
    booking.status === 'accepted' || booking.status === 'in_progress' || booking.status === 'completed';
  const canReassign = mode === 'organization' && organization && orgRole && canAssignJobs(orgRole);

  // Calculate platform fee for payment breakdown
  const platformFeePercentage = await getPlatformFeePercentage();
  const totalAmount = parseFloat(booking.total_amount || '0');
  const platformFee = await calculatePlatformFee(totalAmount, platformFeePercentage);

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/detailer/bookings"
          className="text-[#6FF0C4] hover:text-[#32CE7A] mb-6 inline-block"
        >
          ← Back to Bookings
        </Link>

        <BookingDetailClient
          booking={booking}
          timeline={timeline || []}
          notes={notes || []}
          photos={photos || []}
          canUpdateStatus={canUpdateStatus}
          canReassign={canReassign}
          organizationId={organization?.id}
          platformFee={platformFee}
          platformFeePercentage={platformFeePercentage}
        />
      </div>
    </div>
  );
}

