'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/detailer/dashboard-utils';
import FilterDropdown from '@/components/ui/FilterDropdown';

interface ReviewsPageClientProps {
  initialReviews: any[];
  mode?: 'solo' | 'organization';
  orgRating?: number;
  detailers?: Array<{ profile_id: string; full_name: string }>;
  teams?: Array<{ id: string; name: string }>;
}

const ratingOptions = [
  { value: 'all', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

export default function ReviewsPageClient({ 
  initialReviews,
  mode = 'solo',
  orgRating = 0,
  detailers = [],
  teams = []
}: ReviewsPageClientProps) {
  const [ratingFilter, setRatingFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'rating'>('date');
  const [detailerFilter, setDetailerFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  const filteredReviews = initialReviews
    .filter(r => {
      if (ratingFilter !== 'all' && r.rating !== parseInt(ratingFilter)) return false;
      if (mode === 'organization' && detailerFilter !== 'all') {
        const bookingDetailerId = r.booking?.detailer_id;
        if (!bookingDetailerId) return false;
        // Need to match detailer_id to profile_id
        // For now, we'll filter by checking if detailer exists in the filter list
        return true; // TODO: Implement proper detailer filtering
      }
      if (mode === 'organization' && teamFilter !== 'all') {
        const bookingTeamId = r.booking?.team_id;
        return bookingTeamId === teamFilter;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const averageRating = mode === 'organization' && orgRating > 0
    ? orgRating
    : initialReviews.length > 0
    ? initialReviews.reduce((sum, r) => sum + r.rating, 0) / initialReviews.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {averageRating.toFixed(1)} ⭐
            </h2>
            <p className="text-[#C6CFD9]">
              Based on {initialReviews.length} review{initialReviews.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-4 flex-wrap">
            <FilterDropdown
              label="Filter by Rating"
              options={ratingOptions}
              value={ratingFilter}
              onChange={setRatingFilter}
            />
            {mode === 'organization' && detailers.length > 0 && (
              <FilterDropdown
                label="Detailer"
                options={[
                  { value: 'all', label: 'All Detailers' },
                  ...detailers.map(d => ({ value: d.profile_id, label: d.full_name })),
                ]}
                value={detailerFilter}
                onChange={setDetailerFilter}
              />
            )}
            {mode === 'organization' && teams.length > 0 && (
              <FilterDropdown
                label="Team"
                options={[
                  { value: 'all', label: 'All Teams' },
                  ...teams.map(t => ({ value: t.id, label: t.name })),
                ]}
                value={teamFilter}
                onChange={setTeamFilter}
              />
            )}
            <FilterDropdown
              label="Sort By"
              options={[
                { value: 'date', label: 'Newest First' },
                { value: 'rating', label: 'Highest Rated' },
              ]}
              value={sortBy}
              onChange={(v) => setSortBy(v as 'date' | 'rating')}
            />
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">All Reviews</h2>
        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
            <div className="text-center py-12 text-[#C6CFD9]">
              No reviews found
            </div>
          ) : (
            filteredReviews.map((review) => (
              <Link
                key={review.id}
                href={`/detailer/reviews/${review.id}`}
                className="block bg-[#050B12] border border-white/5 rounded-lg p-6 hover:border-[#6FF0C4]/20 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`text-xl ${
                              i < review.rating ? 'text-yellow-400' : 'text-[#C6CFD9]'
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-sm text-[#C6CFD9]">
                        {review.user?.full_name || 'Anonymous'}
                      </span>
                    </div>
                    {review.review_text && (
                      <p className="text-white mb-2">{review.review_text}</p>
                    )}
                    <div className="text-sm text-[#C6CFD9]">
                      {review.booking?.service?.name && (
                        <span>Service: {review.booking.service.name} • </span>
                      )}
                      {mode === 'organization' && review.booking?.detailer && (
                        <span>Detailer: {review.booking.detailer.full_name} • </span>
                      )}
                      {mode === 'organization' && review.booking?.team && (
                        <span>Team: {review.booking.team.name} • </span>
                      )}
                      {formatDate(review.created_at, 'long')}
                    </div>
                  </div>
                  <div className="text-sm text-[#C6CFD9]">
                    Job #{review.booking?.receipt_id || 'N/A'}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

