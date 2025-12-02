import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { canManageOrgSettings } from '@/lib/detailer/permissions';
import SettingsPageClient from './SettingsPageClient';
import Link from 'next/link';

export default async function SettingsPage() {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const mode = await getDetailerMode();
  const organization = mode === 'organization' ? await getDetailerOrganization() : null;
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;
  const canManageOrg = organization && orgRole && canManageOrgSettings(orgRole);

  // Get detailer record
  const { data: detailerData } = await supabase.rpc('get_detailer_by_profile', {
    p_profile_id: null,
  });

  // Get service areas
  let serviceAreas: any[] = [];
  if (detailerData?.id) {
    const { data } = await supabase
      .from('service_areas')
      .select('*')
      .eq('detailer_id', detailerData.id)
      .eq('is_active', true);
    serviceAreas = data || [];
  }

  // Get notification settings
  const { data: notificationSettings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', profile.id)
    .single();

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
              <p className="text-[#C6CFD9]">Manage your profile and preferences</p>
            </div>
            {canManageOrg && (
              <Link
                href="/detailer/settings/organization"
                className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors"
              >
                Organization Settings
              </Link>
            )}
          </div>
        </div>

        <SettingsPageClient
          profile={profile}
          serviceAreas={serviceAreas}
          notificationSettings={notificationSettings}
        />
      </div>
    </div>
  );
}

