'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createTeam, updateTeam } from '@/app/detailer/teams/actions';

interface TeamFormProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  team?: {
    id: string;
    name: string;
    description: string | null;
    service_area: any;
  } | null;
  onSaved: () => void;
}

export default function TeamForm({
  isOpen,
  onClose,
  organizationId,
  team,
  onSaved,
}: TeamFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceArea, setServiceArea] = useState<{
    cities?: string[];
    provinces?: string[];
    postalCodes?: string[];
  }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDetailers, setAvailableDetailers] = useState<any[]>([]);
  const [selectedDetailers, setSelectedDetailers] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      if (team) {
        setName(team.name);
        setDescription(team.description || '');
        setServiceArea(team.service_area || {});
        loadTeamMembers();
      } else {
        setName('');
        setDescription('');
        setServiceArea({});
        setSelectedDetailers([]);
      }
      loadAvailableDetailers();
    }
  }, [isOpen, team]);

  const loadAvailableDetailers = async () => {
    const { data: members } = await supabase.rpc('get_organization_members', {
      p_organization_id: organizationId,
    });

    const detailerMembers = (members || []).filter((m: any) => m.role === 'detailer' && m.is_active);
    const detailerIds = detailerMembers.map((m: any) => m.profile_id);

    if (detailerIds.length === 0) {
      setAvailableDetailers([]);
      return;
    }

    const { data: detailerRecords } = await supabase
      .from('detailers')
      .select('id, full_name')
      .in('profile_id', detailerIds);

    setAvailableDetailers(detailerRecords || []);
  };

  const loadTeamMembers = async () => {
    if (!team) return;

    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('detailer_id')
      .eq('team_id', team.id);

    setSelectedDetailers((teamMembers || []).map((tm: any) => tm.detailer_id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (team) {
        await updateTeam(team.id, name, description || null, serviceArea, selectedDetailers);
      } else {
        await createTeam(organizationId, name, description || null, serviceArea, selectedDetailers);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-[#0A1A2F] border border-white/5 rounded-xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/5">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">{team ? 'Edit Team' : 'Create Team'}</h2>
            <button
              onClick={onClose}
              className="text-[#C6CFD9] hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                Team Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Team Members</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableDetailers.map((detailer) => (
                  <label
                    key={detailer.id}
                    className="flex items-center p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDetailers.includes(detailer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDetailers([...selectedDetailers, detailer.id]);
                        } else {
                          setSelectedDetailers(selectedDetailers.filter((id) => id !== detailer.id));
                        }
                      }}
                      className="mr-3 w-4 h-4 text-[#32CE7A] bg-[#050B12] border-white/5 rounded focus:ring-[#32CE7A]"
                    />
                    <span className="text-white">{detailer.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white hover:border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name}
              className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : team ? 'Update Team' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

