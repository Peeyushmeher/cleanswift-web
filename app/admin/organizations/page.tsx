import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="px-2 py-1 rounded-md text-xs font-medium bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/30">
      Active
    </span>
  ) : (
    <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
      Inactive
    </span>
  );
}

export default async function AdminOrganizationsPage() {
  // Use regular client - proxy.ts already verified admin access and RLS allows admins
  const supabase = await createClient();

  // Get all organizations
  const { data: orgsRaw, error } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      business_logo_url,
      stripe_connect_account_id,
      is_active,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching organizations:', error);
  }

  // Get member counts from organization_members
  const { data: memberCounts } = await supabase
    .from('organization_members')
    .select('organization_id, role');

  // Get detailers per org
  const { data: detailers } = await supabase
    .from('detailers')
    .select('id, organization_id, full_name');

  // Get bookings with detailer_id to calculate revenue
  const { data: bookings } = await supabase
    .from('bookings')
    .select('detailer_id, total_amount, payment_status')
    .eq('payment_status', 'paid');

  // Calculate stats per organization
  const organizations = (orgsRaw || []).map(org => {
    const members = memberCounts?.filter(m => m.organization_id === org.id) || [];
    const orgDetailers = detailers?.filter(d => d.organization_id === org.id) || [];
    const orgDetailerIds = orgDetailers.map(d => d.id);
    const orgBookings = bookings?.filter(b => orgDetailerIds.includes(b.detailer_id)) || [];
    const revenue = orgBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0);
    
    // Find an owner (first admin member)
    const ownerMember = members.find(m => m.role === 'admin' || m.role === 'owner');

    return {
      ...org,
      member_count: members.length,
      detailer_count: orgDetailers.length,
      total_bookings: orgBookings.length,
      total_revenue: revenue,
      owner: null, // No owner_id in organizations table
    };
  });

  // Server action to toggle status
  async function toggleOrgStatus(formData: FormData) {
    'use server';
    const orgId = formData.get('org_id') as string;
    const currentStatus = formData.get('current_status') === 'true';
    
    if (orgId) {
      const supabase = await createClient();
      
      await supabase
        .from('organizations')
        .update({ is_active: !currentStatus })
        .eq('id', orgId);
      
      revalidatePath('/admin/organizations');
    }
  }

  // Calculate stats
  const totalOrgs = organizations?.length || 0;
  const activeOrgs = organizations?.filter((o: any) => o.is_active).length || 0;
  const totalRevenue = organizations?.reduce((sum: number, o: any) => sum + parseFloat(o.total_revenue || 0), 0) || 0;
  const totalMembers = organizations?.reduce((sum: number, o: any) => sum + (o.member_count || 0), 0) || 0;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Organizations</h1>
        <p className="text-[#C6CFD9]">Manage detailing organizations and teams</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Total Organizations</div>
          <div className="text-2xl font-bold text-white">{totalOrgs}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Active</div>
          <div className="text-2xl font-bold text-[#32CE7A]">{activeOrgs}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Total Members</div>
          <div className="text-2xl font-bold text-white">{totalMembers}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Total Revenue</div>
          <div className="text-2xl font-bold text-[#32CE7A]">${totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Organizations Table */}
      {!organizations || organizations.length === 0 ? (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#C6CFD9] opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
          </svg>
          <p className="text-[#C6CFD9]">No organizations found</p>
        </div>
      ) : (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050B12] border-b border-white/10">
                <tr>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Organization</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Team</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Members</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Detailers</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Bookings</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Revenue</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org: any) => (
                  <tr key={org.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          {org.business_logo_url ? (
                            <img src={org.business_logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <span className="text-purple-400 font-semibold">
                              {org.name?.[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium">{org.name}</div>
                          <div className="text-xs text-[#C6CFD9]">
                            Since {new Date(org.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[#C6CFD9] text-sm">
                        {org.member_count > 0 ? `${org.member_count} member${org.member_count > 1 ? 's' : ''}` : 'No members'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">{org.member_count}</td>
                    <td className="py-3 px-4 text-white text-sm">{org.detailer_count}</td>
                    <td className="py-3 px-4 text-white text-sm">{org.total_bookings}</td>
                    <td className="py-3 px-4 text-[#32CE7A] font-medium">${org.total_revenue.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge isActive={org.is_active} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/organizations/${org.id}`}
                          className="px-3 py-1.5 text-sm text-[#32CE7A] hover:text-[#6FF0C4] hover:bg-[#32CE7A]/10 rounded-lg transition-colors"
                        >
                          View
                        </Link>
                        <form action={toggleOrgStatus}>
                          <input type="hidden" name="org_id" value={org.id} />
                          <input type="hidden" name="current_status" value={String(org.is_active)} />
                          <button
                            type="submit"
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              org.is_active
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-[#32CE7A] hover:bg-[#32CE7A]/10'
                            }`}
                          >
                            {org.is_active ? 'Suspend' : 'Activate'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

