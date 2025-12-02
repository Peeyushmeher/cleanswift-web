'use client';

import { formatDate } from '@/lib/detailer/dashboard-utils';
import type { BookingTimeline } from '@/types/detailer';

interface JobTimelineProps {
  timeline: BookingTimeline[];
  currentStatus: string;
  createdAt: string;
}

export default function JobTimeline({ timeline, currentStatus, createdAt }: JobTimelineProps) {
  // Sort timeline by date (oldest first)
  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Job Timeline</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />

        <div className="space-y-6">
          {/* Initial state */}
          <div className="relative flex items-start gap-4">
            <div className="relative z-10 w-8 h-8 rounded-full bg-[#32CE7A] border-4 border-[#0A1A2F] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
            <div className="flex-1 pt-1">
              <div className="text-white font-medium">Booking Created</div>
              <div className="text-sm text-[#C6CFD9]">{formatDate(createdAt, 'long')}</div>
            </div>
          </div>

          {/* Status transitions */}
          {sortedTimeline.map((entry, index) => (
            <div key={entry.id} className="relative flex items-start gap-4">
              <div className="relative z-10 w-8 h-8 rounded-full bg-[#6FF0C4] border-4 border-[#0A1A2F] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <div className="flex-1 pt-1">
                <div className="text-white font-medium">
                  {entry.status_from
                    ? `${entry.status_from.replace('_', ' ')} → ${entry.status_to.replace('_', ' ')}`
                    : `Status: ${entry.status_to.replace('_', ' ')}`}
                </div>
                <div className="text-sm text-[#C6CFD9]">{formatDate(entry.changed_at, 'long')}</div>
                {entry.notes && (
                  <div className="text-sm text-[#C6CFD9] mt-1 italic">{entry.notes}</div>
                )}
              </div>
            </div>
          ))}

          {/* Current status */}
          {sortedTimeline.length > 0 && (
            <div className="relative flex items-start gap-4">
              <div className="relative z-10 w-8 h-8 rounded-full bg-[#32CE7A] border-4 border-[#0A1A2F] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <div className="flex-1 pt-1">
                <div className="text-white font-medium">Current Status: {currentStatus.replace('_', ' ')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

