'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateMemberRole, suspendMember, activateMember, removeMember } from '../actions';
import { canChangeMemberRoles, canRemoveMembers, OrganizationRoleType } from '@/lib/detailer/permissions';

interface MemberDetailClientProps {
  member: any;
  teams: Array<{ id: string; name: string }>;
  earnings: { total: number; completedJobs: number } | null;
  completedJobs: any[];
  rating: number;
  reviewCount: number;
  organizationId: string;
  currentUserRole: string | null;
}

export default function MemberDetailClient({
  member,
  teams,
  earnings,
  completedJobs,
  rating,
  reviewCount,
  organizationId,
  currentUserRole,
}: MemberDetailClientProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const canChangeRole = canChangeMemberRoles(currentUserRole as OrganizationRoleType | null);
  const canRemove = canRemoveMembers(currentUserRole as OrganizationRoleType | null);

  const handleRoleChange = async (newRole: string) => {
    if (!confirm(`Are you sure you want to change this member's role to ${newRole}?`)) return;
    setLoading(true);
    try {
      await updateMemberRole(organizationId, member.profile_id, newRole as any);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!confirm('Are you sure you want to suspend this member?')) return;
    setLoading(true);
    try {
      await suspendMember(organizationId, member.profile_id);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to suspend member');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      await activateMember(organizationId, member.profile_id);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to activate member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;
    setLoading(true);
    try {
      await removeMember(organizationId, member.profile_id);
      router.push('/detailer/members');
    } catch (error: any) {
      alert(error.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'manager':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'dispatcher':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'detailer':
        return 'bg-[#32CE7A]/20 text-[#32CE7A] border-[#32CE7A]/40';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/detailer/members"
            className="text-[#6FF0C4] hover:text-[#32CE7A] mb-4 inline-block"
          >
            ← Back to Members
          </Link>
          <h1 className="text-3xl font-bold text-white">{member.full_name}</h1>
          <p className="text-[#C6CFD9] mt-1">{member.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getRoleBadgeColor(
              member.role
            )}`}
          >
            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
          </span>
          <span
            className={`inline-block px-3 py-1 rounded text-sm font-medium ${
              member.is_active
                ? 'bg-[#32CE7A]/20 text-[#32CE7A]'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {member.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Member Info */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Member Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-[#C6CFD9] mb-1">Email</div>
            <div className="text-white">{member.email}</div>
          </div>
          <div>
            <div className="text-sm text-[#C6CFD9] mb-1">Role</div>
            <div className="text-white capitalize">{member.role}</div>
          </div>
          <div>
            <div className="text-sm text-[#C6CFD9] mb-1">Status</div>
            <div className="text-white">{member.is_active ? 'Active' : 'Inactive'}</div>
          </div>
          <div>
            <div className="text-sm text-[#C6CFD9] mb-1">Joined</div>
            <div className="text-white">
              {new Date(member.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Teams */}
      {teams.length > 0 && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Teams</h2>
          <div className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/detailer/teams/${team.id}`}
                className="px-3 py-1 bg-[#32CE7A]/20 text-[#32CE7A] rounded-lg hover:bg-[#32CE7A]/30 transition-colors"
              >
                {team.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Performance (if detailer) */}
      {earnings && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-[#C6CFD9] mb-1">Total Earnings</div>
              <div className="text-2xl font-bold text-[#32CE7A]">
                ${earnings.total.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-[#C6CFD9] mb-1">Completed Jobs</div>
              <div className="text-2xl font-bold text-white">{earnings.completedJobs}</div>
            </div>
            <div>
              <div className="text-sm text-[#C6CFD9] mb-1">Rating</div>
              <div className="text-2xl font-bold text-white">
                ⭐ {rating.toFixed(1)} ({reviewCount} reviews)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      {completedJobs.length > 0 && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Completed Jobs</h2>
          <div className="space-y-2">
            {completedJobs.map((job) => (
              <Link
                key={job.id}
                href={`/detailer/bookings/${job.id}`}
                className="block p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">{job.receipt_id}</div>
                    <div className="text-sm text-[#C6CFD9]">{job.service?.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">${job.total_amount || 0}</div>
                    <div className="text-xs text-[#C6CFD9]">
                      {new Date(job.completed_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {(canChangeRole || canRemove) && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
          <div className="space-y-3">
            {canChangeRole && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Change Role</label>
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  disabled={loading}
                  className="w-full md:w-auto px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40 disabled:opacity-50"
                >
                  <option value="detailer">Detailer</option>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            )}

            {canRemove && (
              <div className="flex gap-3">
                {member.is_active ? (
                  <button
                    onClick={handleSuspend}
                    disabled={loading}
                    className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Suspend Member
                  </button>
                ) : (
                  <button
                    onClick={handleActivate}
                    disabled={loading}
                    className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Activate Member
                  </button>
                )}
                <button
                  onClick={handleRemove}
                  disabled={loading}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Remove from Organization
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

