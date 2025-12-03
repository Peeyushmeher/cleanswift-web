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

export default async function AdminDetailersPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    status?: string;
    type?: string;
  }>;
}) {
  // Use regular client - proxy.ts already verified admin access and RLS allows admins
  const supabase = await createClient();
  const params = await searchParams;

  // Get all detailers with related data
  const { data: detailers, error } = await supabase
    .from('detailers')
    .select(`
      id,
      full_name,
      avatar_url,
      is_active,
      rating,
      review_count,
      years_experience,
      organization_id,
      profile_id,
      service_radius_km,
      bio,
      created_at,
      organization:organizations(name)
    `)
    .order('created_at', { ascending: false });

  // Debug logging
  if (error) {
    console.error('Error fetching detailers:', error);
  }

  // Fetch profile emails and onboarding status separately for those who have profile_id
  let detailersWithProfiles = detailers || [];
  const profileIds = detailersWithProfiles.filter((d: any) => d.profile_id).map((d: any) => d.profile_id);
  
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, phone, onboarding_completed')
      .in('id', profileIds);
    
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    
    detailersWithProfiles = detailersWithProfiles.map((d: any) => ({
      ...d,
      profile: d.profile_id ? profileMap.get(d.profile_id) : null,
      is_pending: d.profile_id && profileMap.get(d.profile_id)?.onboarding_completed && !d.is_active,
    }));
  }

  // Filter detailers
  let filteredDetailers = detailersWithProfiles;
  if (params.status === 'active') {
    filteredDetailers = filteredDetailers.filter((d: any) => d.is_active);
  } else if (params.status === 'inactive') {
    filteredDetailers = filteredDetailers.filter((d: any) => !d.is_active);
  } else if (params.status === 'pending') {
    // Pending = onboarding completed but not active
    filteredDetailers = filteredDetailers.filter((d: any) => d.is_pending);
  }

  if (params.type === 'solo') {
    filteredDetailers = filteredDetailers.filter((d: any) => !d.organization_id);
  } else if (params.type === 'org') {
    filteredDetailers = filteredDetailers.filter((d: any) => d.organization_id);
  }

  // Server action to toggle status
  async function toggleDetailerStatus(formData: FormData) {
    'use server';
    const detailerId = formData.get('detailer_id') as string;
    const currentStatus = formData.get('current_status') === 'true';
    
    if (detailerId) {
      const supabase = await createClient();
      
      await supabase
        .from('detailers')
        .update({ is_active: !currentStatus })
        .eq('id', detailerId);
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: currentStatus ? 'deactivate_detailer' : 'activate_detailer',
        p_entity_type: 'detailer',
        p_entity_id: detailerId,
        p_metadata: { new_status: !currentStatus },
      });
      
      revalidatePath('/admin/detailers');
    }
  }

  // Build filter URL
  const buildFilterUrl = (newParams: Record<string, string>) => {
    const current = new URLSearchParams();
    if (params.status) current.set('status', params.status);
    if (params.type) current.set('type', params.type);
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });
    
    const queryString = current.toString();
    return `/admin/detailers${queryString ? `?${queryString}` : ''}`;
  };

  // Calculate stats
  const totalDetailers = detailersWithProfiles.length;
  const activeDetailers = detailersWithProfiles.filter((d: any) => d.is_active).length;
  const pendingDetailers = detailersWithProfiles.filter((d: any) => d.is_pending).length;
  const soloDetailers = detailersWithProfiles.filter((d: any) => !d.organization_id).length;
  const orgDetailers = detailersWithProfiles.filter((d: any) => d.organization_id).length;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Detailers</h1>
        <p className="text-[#C6CFD9]">Manage detailer accounts and performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Total</div>
          <div className="text-2xl font-bold text-white">{totalDetailers}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Active</div>
          <div className="text-2xl font-bold text-[#32CE7A]">{activeDetailers}</div>
        </div>
        <div className={`bg-[#0A1A2F] border rounded-xl p-4 ${pendingDetailers > 0 ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5'}`}>
          <div className="text-[#C6CFD9] text-sm">Pending</div>
          <div className={`text-2xl font-bold ${pendingDetailers > 0 ? 'text-yellow-400' : 'text-white'}`}>
            {pendingDetailers}
          </div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">Solo</div>
          <div className="text-2xl font-bold text-white">{soloDetailers}</div>
        </div>
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
          <div className="text-[#C6CFD9] text-sm">In Organizations</div>
          <div className="text-2xl font-bold text-white">{orgDetailers}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <div className="flex gap-2">
            <Link
              href={buildFilterUrl({ status: '' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !params.status
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
              }`}
            >
              All Status
            </Link>
            <Link
              href={buildFilterUrl({ status: 'active' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                params.status === 'active'
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
              }`}
            >
              Active
            </Link>
            <Link
              href={buildFilterUrl({ status: 'inactive' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                params.status === 'inactive'
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
              }`}
            >
              Inactive
            </Link>
            <Link
              href={buildFilterUrl({ status: 'pending' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                params.status === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
              }`}
            >
              Pending {pendingDetailers > 0 && `(${pendingDetailers})`}
            </Link>
          </div>

          <div className="w-px bg-white/10" />

          {/* Type Filter */}
          <div className="flex gap-2">
            <Link
              href={buildFilterUrl({ type: '' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !params.type
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
              }`}
            >
              All Types
            </Link>
            <Link
              href={buildFilterUrl({ type: 'solo' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                params.type === 'solo'
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
              }`}
            >
              Solo
            </Link>
            <Link
              href={buildFilterUrl({ type: 'org' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                params.type === 'org'
                  ? 'bg-[#32CE7A] text-white'
                  : 'bg-[#050B12] text-[#C6CFD9] hover:bg-white/5 border border-white/10'
              }`}
            >
              In Organization
            </Link>
          </div>
        </div>
      </div>

      {/* Detailers Table */}
      {filteredDetailers.length === 0 ? (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#C6CFD9] opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p className="text-[#C6CFD9]">No detailers found</p>
        </div>
      ) : (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050B12] border-b border-white/10">
                <tr>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Detailer</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Contact</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Rating</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Experience</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Reviews</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetailers.map((detailer: any) => (
                    <tr 
                      key={detailer.id} 
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        detailer.is_pending ? 'bg-yellow-500/10 border-l-4 border-l-yellow-500' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#32CE7A]/20 flex items-center justify-center flex-shrink-0">
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
                            <div className="text-xs text-[#C6CFD9]">
                              Joined {new Date(detailer.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {detailer.organization_id ? (
                          <span className="px-2 py-1 rounded-md text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Organization
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-md text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Solo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-white">{detailer.profile?.email || detailer.full_name}</div>
                        <div className="text-xs text-[#C6CFD9]">{detailer.profile?.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-white">{detailer.rating ? detailer.rating.toFixed(1) : 'N/A'}</span>
                          <span className="text-[#C6CFD9] text-xs">({detailer.review_count || 0})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-white text-sm">
                        {detailer.years_experience || 0} years
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white text-sm">{detailer.review_count || 0} reviews</div>
                        <div className="text-xs text-[#C6CFD9]">
                          {detailer.service_radius_km}km radius
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {detailer.is_pending ? (
                          <span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            Pending Approval
                          </span>
                        ) : (
                          <StatusBadge isActive={detailer.is_active} />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/detailers/${detailer.id}`}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              detailer.is_pending
                                ? 'bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold'
                                : 'text-[#32CE7A] hover:text-[#6FF0C4] hover:bg-[#32CE7A]/10'
                            }`}
                          >
                            {detailer.is_pending ? 'Review Application' : 'View'}
                          </Link>
                          {!detailer.is_pending && (
                            <form action={toggleDetailerStatus}>
                              <input type="hidden" name="detailer_id" value={detailer.id} />
                              <input type="hidden" name="current_status" value={String(detailer.is_active)} />
                              <button
                                type="submit"
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                  detailer.is_active
                                    ? 'text-red-400 hover:bg-red-500/10'
                                    : 'text-[#32CE7A] hover:bg-[#32CE7A]/10'
                                }`}
                              >
                                {detailer.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </form>
                          )}
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
