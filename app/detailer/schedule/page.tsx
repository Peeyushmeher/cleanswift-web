import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canViewAllOrgBookings } from '@/lib/detailer/permissions';
import CalendarView from '../dashboard/CalendarView';
import Link from 'next/link';
import SchedulePageClient from './SchedulePageClient';

export default async function SchedulePage() {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const mode = await getDetailerMode();
  const organization = mode === 'organization' ? await getDetailerOrganization() : null;
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;
  const canViewOrg = mode === 'organization' && organization && orgRole && canViewAllOrgBookings(orgRole);

  // Get detailer record
  const { data: detailerData } = await supabase.rpc('get_detailer_by_profile', {
    p_profile_id: null,
  });

  let myBookings: any[] = [];
  let orgBookings: any[] = [];
  let availabilitySlots: any[] = [];
  let filteredBookings: any[] = [];
  let teams: any[] = [];
  let orgDetailers: any[] = [];

  if (canViewOrg && organization) {
    // Organization mode: Get all org bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select(
        `
        id,
        receipt_id,
        status,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        scheduled_start,
        total_amount,
        team_id,
        detailer_id,
        service:service_id (id, name, price, duration_minutes),
        car:car_id (id, make, model, year, license_plate),
        user:user_id (id, full_name, phone, email),
        team:teams (id, name),
        detailer:detailers (id, full_name),
        address_line1,
        city,
        province,
        postal_code
      `
      )
      .eq('organization_id', organization.id)
      .in('status', ['accepted', 'in_progress', 'completed', 'scheduled'])
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time_start', { ascending: true });

    orgBookings = bookings || [];

    // Get teams for filter
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .eq('organization_id', organization.id)
      .eq('is_active', true);
    teams = teamsData || [];

    // Get detailers for filter
    const { data: members } = await supabase.rpc('get_organization_members', {
      p_organization_id: organization.id,
    });
    orgDetailers = (members || []).filter((m: any) => m.role === 'detailer');
  } else if (detailerData?.id) {
    // Solo mode or detailer in org: Get own bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select(
        `
        id,
        receipt_id,
        status,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        scheduled_start,
        total_amount,
        service:service_id (id, name, price, duration_minutes),
        car:car_id (id, make, model, year, license_plate),
        user:user_id (id, full_name, phone, email),
        address_line1,
        city,
        province,
        postal_code
      `
      )
      .eq('detailer_id', detailerData.id)
      .in('status', ['accepted', 'in_progress', 'completed'])
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time_start', { ascending: true });

    myBookings = bookings || [];

    // Get detailer availability
    const { data: availability } = await supabase
      .from('detailer_availability')
      .select('*')
      .eq('detailer_id', detailerData.id)
      .eq('is_active', true);

    availabilitySlots = availability || [];
    filteredBookings = myBookings;
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Schedule</h1>
          <p className="text-[#C6CFD9]">
            {canViewOrg ? 'View and manage organization schedule' : 'View and manage your job schedule'}
          </p>
        </div>

        <SchedulePageClient
          bookings={canViewOrg ? orgBookings : filteredBookings}
          mode={mode}
          teams={teams}
          detailers={orgDetailers}
          availabilitySlots={availabilitySlots}
        />
      </div>
    </div>
  );
}

