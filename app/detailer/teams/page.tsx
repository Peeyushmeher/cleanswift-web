import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { redirect } from 'next/navigation';
import TeamsPageClient from './TeamsPageClient';

export default async function TeamsPage() {
  const profile = await requireDetailer();
  const mode = await getDetailerMode();

  // Redirect solo detailers (teams are org-only)
  if (mode === 'solo') {
    redirect('/detailer/dashboard');
  }

  const supabase = await createClient();
  const organization = await getDetailerOrganization();

  if (!organization) {
    redirect('/detailer/dashboard');
  }

  const orgId = organization.id;
  const orgRole = await getOrganizationRole(orgId);

  // Get teams
  const { data: teams } = await supabase
    .from('teams')
    .select(`
      *,
      team_members (
        id,
        detailer:detailers (
          id,
          full_name,
          profile:profiles (
            email
          )
        )
      )
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Teams</h1>
          <p className="text-[#C6CFD9]">Manage teams within your organization</p>
        </div>

        <TeamsPageClient 
          initialTeams={teams || []} 
          organizationId={orgId}
          canManageTeams={orgRole === 'owner' || orgRole === 'manager'}
        />
      </div>
    </div>
  );
}

