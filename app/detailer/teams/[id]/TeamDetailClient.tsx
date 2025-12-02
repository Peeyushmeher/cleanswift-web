'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TeamForm from '@/components/detailer/TeamForm';
import { deleteTeam } from '../actions';

interface TeamDetailClientProps {
  team: any;
  bookings: any[];
  metrics: {
    totalRevenue: number;
    completedJobs: number;
    averageRating: number;
    totalMembers: number;
  };
  organizationId: string;
  canManageTeams: boolean;
}

export default function TeamDetailClient({
  team,
  bookings,
  metrics,
  organizationId,
  canManageTeams,
}: TeamDetailClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await deleteTeam(team.id);
      router.push('/detailer/teams');
    } catch (error: any) {
      alert(error.message || 'Failed to delete team');
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/detailer/teams"
              className="text-[#6FF0C4] hover:text-[#32CE7A] mb-4 inline-block"
            >
              ← Back to Teams
            </Link>
            <h1 className="text-3xl font-bold text-white">{team.name}</h1>
            {team.description && (
              <p className="text-[#C6CFD9] mt-1">{team.description}</p>
            )}
          </div>
          {canManageTeams && (
            <div className="flex gap-3">
              <button
                onClick={() => setFormOpen(true)}
                className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors"
              >
                Edit Team
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
            <div className="text-sm text-[#C6CFD9] mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-[#32CE7A]">${metrics.totalRevenue.toFixed(2)}</div>
          </div>
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
            <div className="text-sm text-[#C6CFD9] mb-1">Completed Jobs</div>
            <div className="text-2xl font-bold text-white">{metrics.completedJobs}</div>
          </div>
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
            <div className="text-sm text-[#C6CFD9] mb-1">Average Rating</div>
            <div className="text-2xl font-bold text-white">⭐ {metrics.averageRating.toFixed(1)}</div>
          </div>
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-4">
            <div className="text-sm text-[#C6CFD9] mb-1">Members</div>
            <div className="text-2xl font-bold text-white">{metrics.totalMembers}</div>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Team Members</h2>
          {team.team_members && team.team_members.length > 0 ? (
            <div className="space-y-2">
              {team.team_members.map((tm: any) => (
                <Link
                  key={tm.id}
                  href={`/detailer/members/${tm.detailer.profile?.id || ''}`}
                  className="block p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-white">{tm.detailer.full_name}</div>
                      <div className="text-sm text-[#C6CFD9]">
                        ⭐ {tm.detailer.rating?.toFixed(1) || '0.0'} ({tm.detailer.review_count || 0} reviews)
                      </div>
                    </div>
                    <div className="text-[#32CE7A]">View →</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[#C6CFD9]">No members in this team</p>
          )}
        </div>

        {/* Recent Bookings */}
        {bookings.length > 0 && (
          <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Recent Bookings</h2>
            <div className="space-y-2">
              {bookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/detailer/bookings/${booking.id}`}
                  className="block p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-white">{booking.receipt_id}</div>
                      <div className="text-sm text-[#C6CFD9]">{booking.service?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${booking.total_amount || 0}</div>
                      <div className="text-xs text-[#C6CFD9] capitalize">{booking.status}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <TeamForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        organizationId={organizationId}
        team={team}
        onSaved={() => {
          router.refresh();
        }}
      />
    </>
  );
}

