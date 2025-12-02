'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TeamForm from '@/components/detailer/TeamForm';
import { deleteTeam } from './actions';

interface Team {
  id: string;
  name: string;
  description: string | null;
  service_area: any;
  is_active: boolean;
  created_at: string;
  team_members?: Array<{
    id: string;
    detailer: {
      id: string;
      full_name: string;
      profile?: {
        email: string;
      };
    };
  }>;
}

interface TeamsPageClientProps {
  initialTeams: Team[];
  organizationId: string;
  canManageTeams: boolean;
}

export default function TeamsPageClient({ initialTeams, organizationId, canManageTeams }: TeamsPageClientProps) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleCreate = () => {
    setEditingTeam(null);
    setFormOpen(true);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormOpen(true);
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await deleteTeam(teamId);
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to delete team');
    }
  };

  const handleSaved = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Teams List */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">All Teams</h2>
          {canManageTeams && (
            <button
              className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors"
              onClick={handleCreate}
            >
              + Create Team
            </button>
          )}
        </div>

        {teams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#C6CFD9] mb-4">No teams created yet</p>
            {canManageTeams && (
              <button
                className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors"
                onClick={handleCreate}
              >
                Create Your First Team
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-[#050B12] border border-white/5 rounded-lg p-6 hover:border-[#32CE7A]/40 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <Link href={`/detailer/teams/${team.id}`} className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">{team.name}</h3>
                  </Link>
                  {canManageTeams && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(team)}
                        className="text-[#32CE7A] hover:text-[#6FF0C4] text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(team.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {team.description && (
                  <p className="text-sm text-[#C6CFD9] mb-4">{team.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#C6CFD9]">
                    {team.team_members?.length || 0} member{team.team_members?.length !== 1 ? 's' : ''}
                  </span>
                  <Link
                    href={`/detailer/teams/${team.id}`}
                    className="text-[#32CE7A] hover:text-[#6FF0C4]"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">About Teams</h3>
        <p className="text-[#C6CFD9] text-sm">
          Teams allow you to organize detailers into groups. Each team can have its own service area
          and be assigned to specific jobs. This helps with routing and scheduling.
        </p>
      </div>

      <TeamForm
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTeam(null);
        }}
        organizationId={organizationId}
        team={editingTeam}
        onSaved={handleSaved}
      />
    </div>
  );
}

