import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import ReviewsPageClient from './ReviewsPageClient';

export default async function ReviewsPage() {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const mode = await getDetailerMode();
  const organization = mode === 'organization' ? await getDetailerOrganization() : null;
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;

  // Get detailer record
  const { data: detailerData } = await supabase.rpc('get_detailer_by_profile', {
    p_profile_id: null,
  });

  let reviews: any[] = [];
  let orgDetailers: any[] = [];
  let teams: any[] = [];
  let orgRating = 0;

  if (mode === 'organization' && organization && orgRole && ['owner', 'manager'].includes(orgRole)) {
    // Organization mode: Get all org reviews
    const { data: orgBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('organization_id', organization.id);

    const bookingIds = orgBookings?.map((b) => b.id) || [];

    if (bookingIds.length > 0) {
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(
          `
          *,
          user:user_id (full_name),
          booking:booking_id (
            receipt_id,
            service:service_id (name),
            team_id,
            detailer_id,
            team:teams (id, name),
            detailer:detailers (id, full_name)
          )
        `
        )
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      reviews = reviewsData || [];

      // Calculate org rating
      if (reviews.length > 0) {
        orgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      }

      // Get detailers for filter
      const { data: members } = await supabase.rpc('get_organization_members', {
        p_organization_id: organization.id,
      });
      orgDetailers = (members || []).filter((m: any) => m.role === 'detailer');

      // Get teams for filter
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', organization.id)
        .eq('is_active', true);
      teams = teamsData || [];
    }
  } else if (detailerData?.id) {
    // Solo mode or detailer in org: Get own reviews
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select(
        `
        *,
        user:user_id (full_name),
        booking:booking_id (
          receipt_id,
          service:service_id (name)
        )
      `
      )
      .eq('detailer_id', detailerData.id)
      .order('created_at', { ascending: false });

    reviews = reviewsData || [];
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Reviews</h1>
          <p className="text-[#C6CFD9]">View customer reviews and ratings</p>
        </div>

        <ReviewsPageClient 
          initialReviews={reviews} 
          mode={mode}
          orgRating={orgRating}
          detailers={orgDetailers}
          teams={teams}
        />
      </div>
    </div>
  );
}

