'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrganizationProfile, addServiceZone, deleteServiceZone, updateBusinessHours } from './actions';
import { createClient } from '@/lib/supabase/client';

interface OrganizationSettingsClientProps {
  organization: any;
  initialServiceZones: any[];
}

export default function OrganizationSettingsClient({
  organization,
  initialServiceZones,
}: OrganizationSettingsClientProps) {
  const [name, setName] = useState(organization.name || '');
  const [description, setDescription] = useState((organization as any).description || '');
  const [serviceZones, setServiceZones] = useState(initialServiceZones);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newZone, setNewZone] = useState({ city: '', province: '', postalCodes: '' });
  const router = useRouter();
  const supabase = createClient();

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await updateOrganizationProfile(organization.id, name, description);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddZone = async () => {
    if (!newZone.city || !newZone.province) {
      setError('City and province are required');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const zoneData = {
        city: newZone.city,
        province: newZone.province,
        postalCodes: newZone.postalCodes.split(',').map((p) => p.trim()).filter(Boolean),
      };
      await addServiceZone(organization.id, zoneData);
      setNewZone({ city: '', province: '', postalCodes: '' });
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add service zone');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZone = async (zoneIndex: number) => {
    if (!confirm('Are you sure you want to remove this service zone?')) return;

    setError(null);
    setLoading(true);

    try {
      await deleteServiceZone(organization.id, zoneIndex);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete service zone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Organization Profile */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Organization Profile</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
              Organization Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              suppressHydrationWarning
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
              suppressHydrationWarning
              className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Business Logo
            </label>
            <div className="p-4 bg-[#050B12] border border-white/5 rounded-lg text-[#C6CFD9] text-sm">
              Logo upload feature coming soon
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Service Zones */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Service Zones</h2>
        <div className="space-y-4">
          {serviceZones.map((zone, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 bg-[#050B12] border border-white/5 rounded-lg"
            >
              <div>
                <div className="font-medium text-white">
                  {zone.city}, {zone.province}
                </div>
                {zone.postalCodes && zone.postalCodes.length > 0 && (
                  <div className="text-sm text-[#C6CFD9]">
                    Postal Codes: {zone.postalCodes.join(', ')}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeleteZone(idx)}
                className="text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}

          <div className="p-4 bg-[#050B12] border border-white/5 rounded-lg space-y-3">
            <h3 className="font-medium text-white">Add Service Zone</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="City"
                value={newZone.city}
                onChange={(e) => setNewZone({ ...newZone, city: e.target.value })}
                suppressHydrationWarning
                className="px-4 py-2 bg-[#0A1A2F] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
              />
              <input
                type="text"
                placeholder="Province"
                value={newZone.province}
                onChange={(e) => setNewZone({ ...newZone, province: e.target.value })}
                suppressHydrationWarning
                className="px-4 py-2 bg-[#0A1A2F] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
              />
              <input
                type="text"
                placeholder="Postal Codes (comma-separated)"
                value={newZone.postalCodes}
                onChange={(e) => setNewZone({ ...newZone, postalCodes: e.target.value })}
                suppressHydrationWarning
                className="px-4 py-2 bg-[#0A1A2F] border border-white/5 rounded-lg text-white placeholder-[#C6CFD9] focus:outline-none focus:border-[#32CE7A]/40"
              />
            </div>
            <button
              onClick={handleAddZone}
              disabled={loading || !newZone.city || !newZone.province}
              className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Add Zone
            </button>
          </div>
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Business Hours</h2>
        <div className="p-4 bg-[#050B12] border border-white/5 rounded-lg text-[#C6CFD9] text-sm">
          Business hours management coming soon
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Stripe Connect</h2>
        <div className="p-4 bg-[#050B12] border border-white/5 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium mb-1">Connection Status</div>
              <div className="text-sm text-[#C6CFD9]">
                {organization.stripe_connect_account_id ? 'Connected' : 'Not Connected'}
              </div>
            </div>
            {!organization.stripe_connect_account_id && (
              <button
                disabled
                className="px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-[#C6CFD9] text-sm"
              >
                Connect Stripe (Coming Soon)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

