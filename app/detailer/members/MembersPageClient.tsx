'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import InviteMemberModal from '@/components/detailer/InviteMemberModal';
import { updateMemberRole, suspendMember, activateMember, removeMember } from './actions';

interface Member {
  id: string;
  profile_id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'manager' | 'dispatcher' | 'detailer';
  is_active: boolean;
  created_at: string;
}

interface MembersPageClientProps {
  initialMembers: Member[];
  organizationId: string;
  canManageMembers: boolean;
  canChangeRoles: boolean;
}

export default function MembersPageClient({ 
  initialMembers, 
  organizationId,
  canManageMembers,
  canChangeRoles
}: MembersPageClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [loading, setLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

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

  const handleInvited = () => {
    router.refresh();
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    setActionLoading(profileId);
    try {
      await updateMemberRole(organizationId, profileId, newRole as any);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (profileId: string) => {
    if (!confirm('Are you sure you want to suspend this member?')) return;
    setActionLoading(profileId);
    try {
      await suspendMember(organizationId, profileId);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to suspend member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (profileId: string) => {
    setActionLoading(profileId);
    try {
      await activateMember(organizationId, profileId);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to activate member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (profileId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;
    setActionLoading(profileId);
    try {
      await removeMember(organizationId, profileId);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Members List */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Organization Members</h2>
          {canManageMembers && (
            <button
              className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors"
              onClick={() => setInviteModalOpen(true)}
            >
              + Invite Member
            </button>
          )}
        </div>

        {members.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#C6CFD9] mb-4">No members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#C6CFD9]">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#C6CFD9]">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#C6CFD9]">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#C6CFD9]">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#C6CFD9]">Joined</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-[#C6CFD9]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{member.full_name}</div>
                    </td>
                    <td className="py-3 px-4 text-[#C6CFD9]">{member.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getRoleBadgeColor(
                          member.role
                        )}`}
                      >
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          member.is_active
                            ? 'bg-[#32CE7A]/20 text-[#32CE7A]'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#C6CFD9] text-sm">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/detailer/members/${member.profile_id}`}
                          className="text-[#32CE7A] hover:text-[#6FF0C4] text-sm font-medium"
                        >
                          View →
                        </Link>
                        {canManageMembers && (
                          <>
                            {!member.is_active && (
                              <button
                                onClick={() => handleActivate(member.profile_id)}
                                disabled={actionLoading === member.profile_id}
                                className="text-xs px-2 py-1 bg-[#32CE7A]/20 text-[#32CE7A] rounded hover:bg-[#32CE7A]/30 disabled:opacity-50"
                              >
                                Activate
                              </button>
                            )}
                            {member.is_active && member.role !== 'owner' && (
                              <>
                                <button
                                  onClick={() => handleSuspend(member.profile_id)}
                                  disabled={actionLoading === member.profile_id}
                                  className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 disabled:opacity-50"
                                >
                                  Suspend
                                </button>
                                <button
                                  onClick={() => handleRemove(member.profile_id)}
                                  disabled={actionLoading === member.profile_id}
                                  className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">About Roles</h3>
        <div className="space-y-2 text-sm text-[#C6CFD9]">
          <div>
            <strong className="text-purple-400">Owner:</strong> Full access, can manage everything
          </div>
          <div>
            <strong className="text-blue-400">Manager:</strong> Can manage teams, members, and bookings
          </div>
          <div>
            <strong className="text-yellow-400">Dispatcher:</strong> Can assign jobs and manage schedule
          </div>
          <div>
            <strong className="text-[#32CE7A]">Detailer:</strong> Can view and complete assigned jobs
          </div>
        </div>
        <p className="text-[#C6CFD9] text-sm mt-4">
          <strong>Note:</strong> Full member management features (invite, change roles, remove) will be
          available in Phase 3.
        </p>
      </div>

      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        organizationId={organizationId}
        onInvited={handleInvited}
      />
    </div>
  );
}

