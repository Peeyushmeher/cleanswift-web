import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import JobsPageClient from './JobsPageClient';

export default async function DetailerBookingsPage() {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const mode = await getDetailerMode();
  const organization = mode === 'organization' ? await getDetailerOrganization() : null;
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;

  // Get detailer record
  const { data: detailerData } = await supabase.rpc('get_detailer_by_profile', {
    p_profile_id: null,
  });

  let myBookings: any[] = [];
  let teams: any[] = [];
  let orgDetailers: any[] = [];

  if (detailerData?.id) {
    if (mode === 'organization' && organization && orgRole && ['owner', 'manager', 'dispatcher'].includes(orgRole)) {
      // Organization mode with permissions: Get all org bookings
      // Include 'paid' status (unassigned) for dispatchers to assign
      const { data: bookings } = await supabase
        .from('bookings')
        .select(
          `
          id,
          receipt_id,
          status,
          payment_status,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          scheduled_start,
          scheduled_end,
          total_amount,
          service_price,
          created_at,
          organization_id,
          team_id,
          detailer_id,
          address_line1,
          city,
          province,
          postal_code,
          service:service_id (id, name, price),
          car:car_id (id, make, model, year, license_plate),
          user:user_id (id, full_name, phone, email),
          detailer:detailers (id, full_name),
          team:teams (id, name)
        `
        )
        .eq('organization_id', organization.id)
        .in('status', ['paid', 'offered', 'accepted', 'in_progress', 'completed', 'cancelled'])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time_start', { ascending: true });

      myBookings = bookings || [];

      // Get teams for filter
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', organization.id)
        .eq('is_active', true);

      teams = teamsData || [];

      // Get organization detailers for filter
      const { data: membersData } = await supabase.rpc('get_organization_members', {
        p_organization_id: organization.id,
      });

      orgDetailers = (membersData || []).filter((m: any) => m.role === 'detailer');
    } else {
      // Solo mode or detailer in org: Get own bookings only
      const { data: bookings } = await supabase
        .from('bookings')
        .select(
          `
          id,
          receipt_id,
          status,
          payment_status,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          scheduled_start,
          scheduled_end,
          total_amount,
          service_price,
          created_at,
          address_line1,
          city,
          province,
          postal_code,
          service:service_id (id, name, price),
          car:car_id (id, make, model, year, license_plate),
          user:user_id (id, full_name, phone, email)
        `
        )
        .eq('detailer_id', detailerData.id)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time_start', { ascending: true });

      myBookings = bookings || [];
    }
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Jobs</h1>
          <p className="text-[#C6CFD9]">View and manage your assigned jobs</p>
        </div>

        <JobsPageClient 
          initialBookings={myBookings} 
          mode={mode}
          teams={teams}
          detailers={orgDetailers}
          organizationId={organization?.id}
        />
      </div>
    </div>
  );
}

