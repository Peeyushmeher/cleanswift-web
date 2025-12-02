import { requireDetailer, getDetailerMode } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDetailerOrganization, getOrganizationRole } from '@/lib/detailer/mode-detection';
import { redirect } from 'next/navigation';
import MemberDetailClient from './MemberDetailClient';

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireDetailer();
  const mode = await getDetailerMode();

  // Redirect solo detailers
  if (mode === 'solo') {
    redirect('/detailer/dashboard');
  }

  const supabase = await createClient();
  const organization = await getDetailerOrganization();
  const orgRole = organization ? await getOrganizationRole(organization.id) : null;

  if (!organization) {
    redirect('/detailer/dashboard');
  }

  // Get member details
  const { data: members } = await supabase.rpc('get_organization_members', {
    p_organization_id: organization.id,
  });

  const member = members?.find((m: any) => m.profile_id === params.id);

  if (!member) {
    redirect('/detailer/members');
  }

  // Get member's teams
  const { data: detailerRecord } = await supabase
    .from('detailers')
    .select('id')
    .eq('profile_id', params.id)
    .single();

  let teams: any[] = [];
  let earnings: any = null;
  let completedJobs: any[] = [];
  let rating = 0;
  let reviewCount = 0;

  if (detailerRecord?.id) {
    // Get teams
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('team:teams (id, name)')
      .eq('detailer_id', detailerRecord.id);

    teams = (teamMembers || []).map((tm: any) => tm.team).filter(Boolean);

    // Get earnings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('total_amount, service_price')
      .eq('detailer_id', detailerRecord.id)
      .eq('status', 'completed');

    const totalEarnings = (bookings || []).reduce(
      (sum, b) => sum + (b.total_amount || b.service_price || 0),
      0
    );

    earnings = {
      total: totalEarnings,
      completedJobs: bookings?.length || 0,
    };

    // Get completed jobs
    const { data: jobs } = await supabase
      .from('bookings')
      .select('id, receipt_id, completed_at, total_amount, service:service_id (name)')
      .eq('detailer_id', detailerRecord.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    completedJobs = jobs || [];

    // Get rating
    const { data: detailer } = await supabase
      .from('detailers')
      .select('rating, review_count')
      .eq('id', detailerRecord.id)
      .single();

    rating = detailer?.rating || 0;
    reviewCount = detailer?.review_count || 0;
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MemberDetailClient
          member={member}
          teams={teams}
          earnings={earnings}
          completedJobs={completedJobs}
          rating={rating}
          reviewCount={reviewCount}
          organizationId={organization.id}
          currentUserRole={orgRole as any}
        />
      </div>
    </div>
  );
}

