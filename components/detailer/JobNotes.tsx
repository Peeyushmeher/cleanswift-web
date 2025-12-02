'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/detailer/dashboard-utils';
import { createClient } from '@/lib/supabase/client';
import type { BookingNote } from '@/types/detailer';

interface JobNotesProps {
  bookingId: string;
  initialNotes: BookingNote[];
}

export default function JobNotes({ bookingId, initialNotes }: JobNotesProps) {
  const [notes, setNotes] = useState<BookingNote[]>(initialNotes);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('booking_notes')
        .insert({
          booking_id: bookingId,
          note_text: newNote.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setNotes([...notes, data]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Internal Notes</h3>

      {/* Add note form */}
      <form onSubmit={handleAddNote} className="space-y-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40 resize-none"
          rows={3}
        />
        <button
          type="submit"
          disabled={isSubmitting || !newNote.trim()}
          className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Adding...' : 'Add Note'}
        </button>
      </form>

      {/* Notes list */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-[#C6CFD9] text-sm">No notes yet</p>
        ) : (
          notes
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((note) => (
              <div
                key={note.id}
                className="bg-[#050B12] border border-white/5 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm text-[#C6CFD9]">
                    {formatDate(note.created_at, 'long')}
                  </div>
                </div>
                <div className="text-white whitespace-pre-wrap">{note.note_text}</div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

