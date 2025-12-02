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

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function AdminDetailerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get detailer full profile
  const { data: detailer, error } = await supabase.rpc('get_detailer_full_profile', {
    p_detailer_id: id,
  });

  if (error || !detailer) {
    notFound();
  }

  // Server actions
  async function toggleStatus(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    await supabase.rpc('admin_update_detailer', {
      p_detailer_id: id,
      p_updates: { is_active: !detailer.is_active },
    });
    
    revalidatePath(`/admin/detailers/${id}`);
  }

  async function updateSettings(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const serviceRadius = formData.get('service_radius_km');
    const bio = formData.get('bio');
    
    await supabase.rpc('admin_update_detailer', {
      p_detailer_id: id,
      p_updates: {
        service_radius_km: serviceRadius ? parseInt(serviceRadius as string) : null,
        bio: bio as string,
      },
    });
    
    revalidatePath(`/admin/detailers/${id}`);
  }

  // Calculate completion rate
  const completionRate = detailer.stats.total_bookings > 0
    ? Math.round((detailer.stats.completed_bookings / detailer.stats.total_bookings) * 100)
    : 0;

  const cancellationRate = detailer.stats.total_bookings > 0
    ? Math.round((detailer.stats.cancelled_bookings / detailer.stats.total_bookings) * 100)
    : 0;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/detailers"
          className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Detailers
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#32CE7A]/20 flex items-center justify-center flex-shrink-0">
              {detailer.avatar_url ? (
                <img src={detailer.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <span className="text-[#32CE7A] font-bold text-2xl">
                  {detailer.full_name?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{detailer.full_name}</h1>
              <div className="flex items-center gap-3">
                {detailer.is_active ? (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/30">
                    Active
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    Inactive
                  </span>
                )}
                {detailer.organization ? (
                  <span className="px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {detailer.organization.name}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Solo Detailer
                  </span>
                )}
              </div>
            </div>
          </div>

          <form action={toggleStatus}>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                detailer.is_active
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  : 'bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/30 hover:bg-[#32CE7A]/30'
              }`}
            >
              {detailer.is_active ? 'Suspend Detailer' : 'Activate Detailer'}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Performance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Total Bookings</div>
              <div className="text-2xl font-bold text-white">{detailer.stats.total_bookings}</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Completion Rate</div>
              <div className="text-2xl font-bold text-[#32CE7A]">{completionRate}%</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Cancellation Rate</div>
              <div className="text-2xl font-bold text-red-400">{cancellationRate}%</div>
            </div>
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
              <div className="text-[#C6CFD9] text-sm mb-1">Lifetime Earnings</div>
              <div className="text-2xl font-bold text-[#32CE7A]">${detailer.stats.lifetime_earnings}</div>
            </div>
          </div>

          {/* 30-Day Performance */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Last 30 Days</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-white">{detailer.stats.last_30_days_bookings}</div>
                <div className="text-[#C6CFD9] text-sm">Bookings</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#32CE7A]">${detailer.stats.last_30_days_earnings}</div>
                <div className="text-[#C6CFD9] text-sm">Earnings</div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Contact Information
            </h2>
            <div className="space-y-3">
              {detailer.profile?.email && (
                <div className="flex items-center gap-3 text-[#C6CFD9]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <span>{detailer.profile.email}</span>
                </div>
              )}
              {detailer.profile?.phone && (
                <div className="flex items-center gap-3 text-[#C6CFD9]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  <span>{detailer.profile.phone}</span>
                </div>
              )}
              <div className="text-sm text-[#C6CFD9]/60">
                Member since {new Date(detailer.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Bio & Specialties */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
            
            {detailer.bio && (
              <div className="mb-4">
                <div className="text-sm text-[#C6CFD9] mb-1">Bio</div>
                <p className="text-white">{detailer.bio}</p>
              </div>
            )}

            {detailer.specialties && detailer.specialties.length > 0 && (
              <div className="mb-4">
                <div className="text-sm text-[#C6CFD9] mb-2">Specialties</div>
                <div className="flex flex-wrap gap-2">
                  {detailer.specialties.map((specialty: string, index: number) => (
                    <span key={index} className="px-3 py-1 bg-[#050B12] text-white text-sm rounded-full border border-white/10">
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#C6CFD9]">Experience:</span>
                <span className="text-white ml-2">{detailer.years_experience || 0} years</span>
              </div>
              <div>
                <span className="text-[#C6CFD9]">Service Radius:</span>
                <span className="text-white ml-2">{detailer.service_radius_km || 50} km</span>
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Bookings</h2>
            {detailer.recent_bookings && detailer.recent_bookings.length > 0 ? (
              <div className="space-y-3">
                {detailer.recent_bookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-[#050B12] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-white font-medium">{booking.customer_name}</div>
                        <div className="text-sm text-[#C6CFD9]">{booking.service_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={booking.status} />
                      <div className="text-right">
                        <div className="text-white font-medium">${booking.total_amount}</div>
                        <div className="text-xs text-[#C6CFD9]">
                          {new Date(booking.scheduled_date).toLocaleDateString()}
                        </div>
                      </div>
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

          {/* Reviews */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Reviews ({detailer.review_count || 0})
            </h2>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl font-bold text-white">{detailer.rating ? detailer.rating.toFixed(1) : 'N/A'}</span>
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-5 h-5 ${star <= Math.round(detailer.rating || 0) ? 'text-yellow-400' : 'text-gray-600'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            {detailer.recent_reviews && detailer.recent_reviews.length > 0 ? (
              <div className="space-y-3">
                {detailer.recent_reviews.map((review: any) => (
                  <div key={review.id} className="p-3 bg-[#050B12] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{review.customer_name}</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-600'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    {review.review_text && (
                      <p className="text-[#C6CFD9] text-sm">{review.review_text}</p>
                    )}
                    <div className="text-xs text-[#C6CFD9]/60 mt-2">
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9]">No reviews yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Availability */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Availability</h2>
            {detailer.availability && detailer.availability.length > 0 ? (
              <div className="space-y-2">
                {detailer.availability.map((slot: any) => (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      slot.is_active ? 'bg-[#050B12]' : 'bg-[#050B12]/50 opacity-50'
                    }`}
                  >
                    <span className="text-white text-sm">{dayNames[slot.day_of_week]}</span>
                    <span className="text-[#C6CFD9] text-sm">
                      {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#C6CFD9] text-sm">No availability set</p>
            )}
          </div>

          {/* Edit Settings */}
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Edit Settings</h2>
            <form action={updateSettings} className="space-y-4">
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Service Radius (km)</label>
                <input
                  type="number"
                  name="service_radius_km"
                  defaultValue={detailer.service_radius_km || 50}
                  min={1}
                  max={200}
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                />
              </div>
              <div>
                <label className="text-sm text-[#C6CFD9] mb-1 block">Bio</label>
                <textarea
                  name="bio"
                  defaultValue={detailer.bio || ''}
                  rows={4}
                  className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50 resize-none"
                  placeholder="Detailer bio..."
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

          {/* Organization Link */}
          {detailer.organization && (
            <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Organization</h2>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{detailer.organization.name}</div>
                  <div className="text-sm text-[#C6CFD9]">
                    {detailer.organization.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <Link
                  href={`/admin/organizations/${detailer.organization.id}`}
                  className="px-3 py-1.5 text-sm text-[#32CE7A] hover:text-[#6FF0C4] hover:bg-[#32CE7A]/10 rounded-lg transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

