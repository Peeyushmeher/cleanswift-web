'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Detailer {
  id: string;
  full_name: string;
  rating: number;
  review_count: number;
  current_job_count: number;
  distance?: number;
  reason: string;
}

interface RoutingSuggestionsProps {
  bookingId: string;
  organizationId: string;
  bookingLocation?: { latitude: number; longitude: number };
  onSelectDetailer: (detailerId: string) => void;
}

type SuggestionType = 'nearest' | 'most_available' | 'best_rated' | 'least_busy';

export default function RoutingSuggestions({
  bookingId,
  organizationId,
  bookingLocation,
  onSelectDetailer,
}: RoutingSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Record<SuggestionType, Detailer[]>>({
    nearest: [],
    most_available: [],
    best_rated: [],
    least_busy: [],
  });
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadSuggestions();
  }, [bookingId, organizationId, bookingLocation]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      // Get organization detailers
      const { data: members } = await supabase.rpc('get_organization_members', {
        p_organization_id: organizationId,
      });

      const detailerMembers = (members || []).filter((m: any) => m.role === 'detailer' && m.is_active);
      const detailerIds = detailerMembers.map((m: any) => m.profile_id);

      if (detailerIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get detailer records
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

      // Build detailer list with metrics
      const detailers = (detailerRecords || []).map((d) => ({
        id: d.id,
        full_name: d.full_name,
        rating: d.rating || 0,
        review_count: d.review_count || 0,
        current_job_count: jobCounts[d.id] || 0,
        distance: undefined, // TODO: Calculate distance if bookingLocation is available
      }));

      // Generate suggestions
      const nearest = [...detailers]
        .sort((a, b) => (a.distance || 999) - (b.distance || 999))
        .slice(0, 3)
        .map((d) => ({ ...d, reason: 'Closest to job location' }));

      const most_available = [...detailers]
        .sort((a, b) => a.current_job_count - b.current_job_count)
        .slice(0, 3)
        .map((d) => ({ ...d, reason: 'Fewest active jobs' }));

      const best_rated = [...detailers]
        .filter((d) => d.review_count > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3)
        .map((d) => ({ ...d, reason: 'Highest customer rating' }));

      const least_busy = [...detailers]
        .sort((a, b) => a.current_job_count - b.current_job_count)
        .slice(0, 3)
        .map((d) => ({ ...d, reason: 'Least busy' }));

      setSuggestions({
        nearest,
        most_available,
        best_rated,
        least_busy,
      });
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  const hasSuggestions = Object.values(suggestions).some((s) => s.length > 0);

  if (!hasSuggestions) {
    return (
      <div className="text-center py-8 text-[#C6CFD9]">
        No suggestions available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white mb-4">Routing Suggestions</h3>

      {/* Nearest */}
      {suggestions.nearest.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#C6CFD9] mb-2">📍 Nearest</h4>
          <div className="space-y-2">
            {suggestions.nearest.map((detailer) => (
              <button
                key={detailer.id}
                onClick={() => onSelectDetailer(detailer.id)}
                className="w-full p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 transition-colors text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">{detailer.full_name}</div>
                    <div className="text-xs text-[#C6CFD9] mt-1">{detailer.reason}</div>
                  </div>
                  <div className="text-sm text-[#32CE7A]">Select →</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Most Available */}
      {suggestions.most_available.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#C6CFD9] mb-2">⏰ Most Available</h4>
          <div className="space-y-2">
            {suggestions.most_available.map((detailer) => (
              <button
                key={detailer.id}
                onClick={() => onSelectDetailer(detailer.id)}
                className="w-full p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 transition-colors text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">{detailer.full_name}</div>
                    <div className="text-xs text-[#C6CFD9] mt-1">
                      {detailer.reason} • {detailer.current_job_count} active jobs
                    </div>
                  </div>
                  <div className="text-sm text-[#32CE7A]">Select →</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Best Rated */}
      {suggestions.best_rated.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#C6CFD9] mb-2">⭐ Best Rated</h4>
          <div className="space-y-2">
            {suggestions.best_rated.map((detailer) => (
              <button
                key={detailer.id}
                onClick={() => onSelectDetailer(detailer.id)}
                className="w-full p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 transition-colors text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">{detailer.full_name}</div>
                    <div className="text-xs text-[#C6CFD9] mt-1">
                      {detailer.reason} • ⭐ {detailer.rating.toFixed(1)} ({detailer.review_count} reviews)
                    </div>
                  </div>
                  <div className="text-sm text-[#32CE7A]">Select →</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Least Busy */}
      {suggestions.least_busy.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#C6CFD9] mb-2">📊 Least Busy</h4>
          <div className="space-y-2">
            {suggestions.least_busy.map((detailer) => (
              <button
                key={detailer.id}
                onClick={() => onSelectDetailer(detailer.id)}
                className="w-full p-3 bg-[#050B12] border border-white/5 rounded-lg hover:border-[#32CE7A]/40 transition-colors text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-white">{detailer.full_name}</div>
                    <div className="text-xs text-[#C6CFD9] mt-1">
                      {detailer.reason} • {detailer.current_job_count} active jobs
                    </div>
                  </div>
                  <div className="text-sm text-[#32CE7A]">Select →</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

