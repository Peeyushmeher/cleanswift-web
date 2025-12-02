import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    accepted: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    completed: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dispatcher: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    detailer: 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/30',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${colors[role] || 'bg-gray-500/20 text-gray-400'}`}>
      {role}
    </span>
  );
}

export default async function AdminOrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get organization details
  const { data: org, error } = await supabase.rpc('get_organization_details', {
    p_organization_id: id,
  });

  if (error || !org) {
    notFound();
  }

  // Server actions
  async function toggleStatus(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    await supabase.rpc('admin_update_organization', {
      p_organization_id: id,
      p_updates: { is_active: !org.is_active },
    });
    
    revalidatePath(`/admin/organizations/${id}`);
  }

  async function updateOrg(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const name = formData.get('name');
    
    await supabase.rpc('admin_update_organization', {
      p_organization_id: id,
      p_updates: { name: name as string },
    });
    
    revalidatePath(`/admin/organizations/${id}`);
  }

  // Find owner
  const owner = org.members?.find((m: any) => m.role === 'owner');

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/organizations"
          className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Organizations
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              {org.business_logo_url ? (
                <img src={org.business_logo_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <span className="text-purple-400 font-bold text-2xl">
                  {org.name?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{org.name}</h1>
              <div className="flex items-center gap-3">
                {org.is_active ? (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/30">
                    Active
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    Suspended
                  </span>
                )}
                {org.stripe_connect_account_id && (
                  <span className="px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Stripe Connected
                  </span>
                )}
              </div>
            </div>
          </div>

          <form action={toggleStatus}>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                org.is_active
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  : 'bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/30 hover:bg-[#32CE7A]/30'
              }`}
            >
              {org.is_active ? 'Suspend Organization' : 'Activate Organization'}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Total Bookings</div>
              <div className="text-2xl font-bold text-white">{org.stats.total_bookings}</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-[#32CE7A]">{org.stats.completed_bookings}</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Lifetime Revenue</div>
              <div className="text-2xl font-bold text-[#32CE7A]">${org.stats.total_revenue}</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Last 30 Days</div>
              <div className="text-2xl font-bold text-white">${org.stats.last_30_days_revenue}</div>
            </div>
          </div>

          {/* Members */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              Members ({org.members?.length || 0})
            </h2>
            {org.members && org.members.length > 0 ? (
              <div className="space-y-3">
                {org.members.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-[#050B12] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#32CE7A]/20 flex items-center justify-center">
                        <span className="text-[#32CE7A] font-semibold">
                          {member.profile?.full_name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-white font-medium">{member.profile?.full_name}</div>
                        <div className="text-sm text-[#C6CFD9]">{member.profile?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RoleBadge role={member.role} />
                      {!member.is_active && (
                        <span className="px-2 py-1 rounded-md text-xs bg-red-500/20 text-red-400">Inactive</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9]">No members</p>
            )}
          </div>

          {/* Detailers */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
              </svg>
              Detailers ({org.detailers?.length || 0})
            </h2>
            {org.detailers && org.detailers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {org.detailers.map((detailer: any) => (
                  <div key={detailer.id} className="flex items-center justify-between p-3 bg-[#050B12] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#32CE7A]/20 flex items-center justify-center">
                        {detailer.avatar_url ? (
                          <img src={detailer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <span className="text-[#32CE7A] font-semibold">
                            {detailer.full_name?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-white font-medium">{detailer.full_name}</div>
                        <div className="text-sm text-[#C6CFD9]">
                          {detailer.booking_count} bookings • ★ {detailer.rating?.toFixed(1) || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/admin/detailers/${detailer.id}`}
                      className="p-2 text-[#C6CFD9] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9]">No detailers</p>
            )}
          </div>

          {/* Recent Bookings */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Bookings</h2>
            {org.recent_bookings && org.recent_bookings.length > 0 ? (
              <div className="space-y-3">
                {org.recent_bookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-[#050B12] rounded-lg">
                    <div>
                      <div className="text-white font-medium">{booking.customer_name}</div>
                      <div className="text-sm text-[#C6CFD9]">
                        {booking.detailer_name || 'Unassigned'} • {new Date(booking.scheduled_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={booking.status} />
                      <div className="text-white font-medium">${booking.total_amount}</div>
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="p-1 text-[#C6CFD9] hover:text-white"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9]">No bookings yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Organization Info */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Organization Info</h2>
            <div className="space-y-3">
              {owner && (
                <div>
                  <div className="text-sm text-[#C6CFD9] mb-1">Owner</div>
                  <div className="text-white">{owner.profile?.full_name}</div>
                  <div className="text-sm text-[#C6CFD9]">{owner.profile?.email}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-[#C6CFD9] mb-1">Founded</div>
                <div className="text-white">{new Date(org.created_at).toLocaleDateString()}</div>
              </div>
              {org.stripe_connect_account_id && (
                <div>
                  <div className="text-sm text-[#C6CFD9] mb-1">Stripe Account</div>
                  <a
                    href={`https://dashboard.stripe.com/connect/accounts/${org.stripe_connect_account_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#32CE7A] hover:text-[#6FF0C4] flex items-center gap-1"
                  >
                    View in Stripe
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Edit Settings */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Edit Settings</h2>
            <form action={updateOrg} className="space-y-4">
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Organization Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={org.name}
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </form>
          </div>

          {/* Teams */}
          {org.teams && org.teams.length > 0 && (
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Teams ({org.teams.length})</h2>
              <div className="space-y-2">
                {org.teams.map((team: any) => (
                  <div key={team.id} className="p-3 bg-[#050B12] rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="text-white font-medium">{team.name}</div>
                      <span className="text-sm text-[#C6CFD9]">{team.member_count} members</span>
                    </div>
                    {team.description && (
                      <div className="text-sm text-[#C6CFD9] mt-1">{team.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

