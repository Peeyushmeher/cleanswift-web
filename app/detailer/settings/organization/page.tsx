import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canManageOrgSettings } from '@/lib/detailer/permissions';
import { redirect } from 'next/navigation';
import OrganizationSettingsClient from './OrganizationSettingsClient';

export default async function OrganizationSettingsPage() {
  const profile = await requireDetailer();
  const mode = await getDetailerMode();

  if (mode === 'solo') {
    redirect('/detailer/settings');
  }

  const supabase = await createClient();
  const organization = await getDetailerOrganization();
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;

  if (!organization) {
    redirect('/detailer/settings');
  }

  // Check permissions
  if (!canManageOrgSettings(orgRole)) {
    redirect('/detailer/settings');
  }

  // Get service zones from service_area JSONB column
  const serviceZones: any[] = organization.service_area && Array.isArray(organization.service_area)
    ? organization.service_area
    : [];

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Organization Settings</h1>
          <p className="text-[#C6CFD9]">Manage your organization profile and settings</p>
        </div>

        <OrganizationSettingsClient
          organization={organization}
          initialServiceZones={serviceZones}
        />
      </div>
    </div>
  );
}

