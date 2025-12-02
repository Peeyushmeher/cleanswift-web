'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { assignJobToDetailer } from '@/app/detailer/bookings/actions';

interface Detailer {
  id: string;
  full_name: string;
  rating: number;
  review_count: number;
  current_job_count?: number;
  distance?: number;
  is_available?: boolean;
}

interface JobAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  organizationId: string;
  currentDetailerId?: string | null;
  onAssigned: () => void;
}

export default function JobAssignmentModal({
  isOpen,
  onClose,
  bookingId,
  organizationId,
  currentDetailerId,
  onAssigned,
}: JobAssignmentModalProps) {
  const [detailers, setDetailers] = useState<Detailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedDetailerId, setSelectedDetailerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadDetailers();
      loadTeams();
    }
  }, [isOpen, organizationId]);

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true);
    setTeams(data || []);
  };

  const loadDetailers = async () => {
    setLoading(true);
    try {
      // Get organization detailers
      const { data: members } = await supabase.rpc('get_organization_members', {
        p_organization_id: organizationId,
      });

      const detailerMembers = (members || []).filter((m: any) => m.role === 'detailer' && m.is_active);

      // Get detailer records with ratings
      const detailerIds = detailerMembers.map((m: any) => m.profile_id);
      if (detailerIds.length === 0) {
        setDetailers([]);
        setLoading(false);
        return;
      }

      const { data: detailerRecords } = await supabase
        .from('detailers')
        .select('id, full_name, rating, review_count')
        .in('profile_id', detailerIds);

      // Get current job counts
      const { data: bookings } = await supabase
        .from('bookings')
        .select('detailer_id')
        .eq('organization_id', organizationId)
        .in('status', ['accepted', 'in_progress', 'scheduled']);

      const jobCounts: Record<string, number> = {};
      bookings?.forEach((b) => {
        if (b.detailer_id) {
          jobCounts[b.detailer_id] = (jobCounts[b.detailer_id] || 0) + 1;
        }
      });

      // Combine data
      const detailersWithCounts = (detailerRecords || []).map((d) => ({
        id: d.id,
        full_name: d.full_name,
        rating: d.rating || 0,
        review_count: d.review_count || 0,
        current_job_count: jobCounts[d.id] || 0,
        is_available: true, // TODO: Check availability slots
      }));

      setDetailers(detailersWithCounts);
    } catch (error) {
      console.error('Error loading detailers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDetailerId) return;

    setAssigning(true);
    try {
      await assignJobToDetailer(bookingId, selectedDetailerId);
      onAssigned();
      onClose();
    } catch (error) {
      console.error('Error assigning job:', error);
      alert('Failed to assign job. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const filteredDetailers = detailers.filter((d) => {
    const matchesSearch = d.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    // TODO: Filter by team when team_id is available in detailer data
    return matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-[#0A1A2F] border border-white/5 rounded-xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Assign Job to Detailer</h2>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <input
              type="text"
              placeholder="Search detailers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
            />
            {teams.length > 0 && (
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
              >
                <option value="all">All Teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Detailers List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredDetailers.length === 0 ? (
            <div className="text-center py-12 text-[#C6CFD9]">
              No detailers found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDetailers.map((detailer) => (
                <button
                  key={detailer.id}
                  onClick={() => setSelectedDetailerId(detailer.id)}
                  className={`
                    w-full p-4 rounded-lg border transition-colors text-left
                    ${
                      selectedDetailerId === detailer.id
                        ? 'bg-[#32CE7A]/20 border-[#32CE7A]/40'
                        : 'bg-[#050B12] border-white/5 hover:border-white/10'
                    }
                    ${detailer.id === currentDetailerId ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  disabled={detailer.id === currentDetailerId}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-white">{detailer.full_name}</h3>
                        {detailer.id === currentDetailerId && (
                          <span className="text-xs bg-[#32CE7A]/20 text-[#32CE7A] px-2 py-1 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-[#C6CFD9]">
                        <span>⭐ {detailer.rating.toFixed(1)} ({detailer.review_count} reviews)</span>
                        <span>📋 {detailer.current_job_count} active jobs</span>
                        {detailer.distance && <span>📍 {detailer.distance.toFixed(1)} km</span>}
                      </div>
                    </div>
                    {selectedDetailerId === detailer.id && (
                      <div className="ml-4">
                        <div className="w-5 h-5 rounded-full bg-[#32CE7A] flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white hover:border-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedDetailerId || assigning}
            className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assigning ? 'Assigning...' : 'Assign Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

