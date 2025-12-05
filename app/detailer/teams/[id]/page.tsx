import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { redirect } from 'next/navigation';
import TeamDetailClient from './TeamDetailClient';

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireDetailer();
  const mode = await getDetailerMode();

  if (mode === 'solo') {
    redirect('/detailer/dashboard');
  }

  const supabase = await createClient();
  const organization = await getDetailerOrganization();
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;

  if (!organization) {
    redirect('/detailer/dashboard');
  }

  // Get team details
  const { data: team } = await supabase
    .from('teams')
    .select(`
      *,
      team_members (
        id,
        detailer:detailers (
          id,
          full_name,
          rating,
          review_count,
          profile:profiles (email)
        )
      )
    `)
    .eq('id', id)
    .eq('organization_id', organization.id)
    .single();

  if (!team) {
    redirect('/detailer/teams');
  }

  // Get team's bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, receipt_id, status, total_amount, scheduled_date, service:service_id (name)')
    .eq('team_id', id)
    .order('scheduled_date', { ascending: false })
    .limit(20);

  // Calculate team metrics
  const completedBookings = bookings?.filter((b) => b.status === 'completed') || [];
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const avgRating =
    team.team_members?.reduce((sum: number, tm: any) => sum + (tm.detailer?.rating || 0), 0) /
      (team.team_members?.length || 1) || 0;

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TeamDetailClient
          team={team}
          bookings={bookings || []}
          metrics={{
            totalRevenue,
            completedJobs: completedBookings.length,
            averageRating: avgRating,
            totalMembers: team.team_members?.length || 0,
          }}
          organizationId={organization.id}
          canManageTeams={orgRole === 'owner' || orgRole === 'manager'}
        />
      </div>
    </div>
  );
}

