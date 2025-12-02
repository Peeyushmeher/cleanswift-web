'use client';

import { useState } from 'react';
import { inviteMember } from '@/app/detailer/members/actions';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onInvited: () => void;
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  organizationId,
  onInvited,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'detailer' | 'dispatcher' | 'manager' | 'owner'>('detailer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await inviteMember(organizationId, email, role);
      setEmail('');
      setRole('detailer');
      onInvited();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to invite member');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-[#0A1A2F] border border-white/5 rounded-xl shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Invite Member</h2>
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
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="member@example.com"
                className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
              />
              <p className="mt-1 text-xs text-[#C6CFD9]">
                User must already have an account with this email
              </p>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-white mb-2">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
              >
                <option value="detailer">Detailer</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
              <p className="mt-1 text-xs text-[#C6CFD9]">
                {role === 'owner' && 'Owners have full access to all organization features'}
                {role === 'manager' && 'Managers can manage teams, members, and bookings'}
                {role === 'dispatcher' && 'Dispatchers can assign jobs and manage schedules'}
                {role === 'detailer' && 'Detailers can view and complete assigned jobs'}
              </p>
            </div>
          </div>

          {/* Footer */}
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
              disabled={loading || !email}
              className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Inviting...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

