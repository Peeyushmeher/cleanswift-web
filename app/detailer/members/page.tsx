import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { redirect } from 'next/navigation';
import MembersPageClient from './MembersPageClient';

export default async function MembersPage() {
  const profile = await requireDetailer();
  const mode = await getDetailerMode();

  // Redirect solo detailers (members are org-only)
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

  // Get organization members
  const { data: members } = await supabase.rpc('get_organization_members', {
    p_organization_id: orgId,
  });

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Members</h1>
          <p className="text-[#C6CFD9]">Manage members of your organization</p>
        </div>

        <MembersPageClient 
          initialMembers={members || []} 
          organizationId={orgId}
          canManageMembers={orgRole === 'owner' || orgRole === 'manager'}
          canChangeRoles={orgRole === 'owner'}
        />
      </div>
    </div>
  );
}

