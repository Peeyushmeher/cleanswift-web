'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface SettingsPageClientProps {
  profile: any;
  serviceAreas: any[];
  notificationSettings: any;
}

export default function SettingsPageClient({
  profile,
  serviceAreas,
  notificationSettings,
}: SettingsPageClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    city: serviceAreas[0]?.city || '',
    province: serviceAreas[0]?.province || '',
    postal_code: serviceAreas[0]?.postal_code || '',
    push_enabled: notificationSettings?.push_enabled ?? true,
    email_enabled: notificationSettings?.email_enabled ?? false,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update profile
      await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq('id', profile.id);

      // Update service area (for solo mode, only one)
      if (serviceAreas.length > 0) {
        await supabase
          .from('service_areas')
          .update({
            city: formData.city,
            province: formData.province,
            postal_code: formData.postal_code,
          })
          .eq('id', serviceAreas[0].id);
      }

      // Update notification settings
      if (notificationSettings) {
        await supabase
          .from('notification_settings')
          .update({
            push_enabled: formData.push_enabled,
            email_enabled: formData.email_enabled,
          })
          .eq('user_id', profile.id);
      }

      router.refresh();
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              suppressHydrationWarning
              className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
              Email
            </label>
            <input
              type="email"
              value={profile.email || ''}
              disabled
              suppressHydrationWarning
              className="w-full px-4 py-2 bg-[#050B12]/50 border border-white/5 rounded-lg text-[#C6CFD9] cursor-not-allowed"
            />
            <p className="text-xs text-[#C6CFD9] mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              suppressHydrationWarning
              className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
            />
          </div>
        </div>
      </div>

      {/* Service Area Section */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Service Area</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              suppressHydrationWarning
              className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
              Province
            </label>
            <input
              type="text"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              suppressHydrationWarning
              className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
              Postal Code
            </label>
            <input
              type="text"
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              suppressHydrationWarning
              className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#32CE7A]/40"
            />
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Notification Preferences</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#C6CFD9]">Push Notifications</span>
            <input
              type="checkbox"
              checked={formData.push_enabled}
              onChange={(e) => setFormData({ ...formData, push_enabled: e.target.checked })}
              suppressHydrationWarning
              className="w-12 h-6 rounded-full bg-[#050B12] border border-white/5 appearance-none relative cursor-pointer checked:bg-[#32CE7A] transition-colors"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#C6CFD9]">Email Notifications</span>
            <input
              type="checkbox"
              checked={formData.email_enabled}
              onChange={(e) => setFormData({ ...formData, email_enabled: e.target.checked })}
              suppressHydrationWarning
              className="w-12 h-6 rounded-full bg-[#050B12] border border-white/5 appearance-none relative cursor-pointer checked:bg-[#32CE7A] transition-colors"
            />
          </label>
        </div>
      </div>

      {/* Stripe Connect Status */}
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Payment Account</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#C6CFD9]">Stripe Connect Account</p>
            <p className="text-sm text-[#C6CFD9] mt-1">
              Status: Not Connected (Placeholder)
            </p>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-[#32CE7A]/20 text-[#32CE7A] rounded-lg cursor-not-allowed"
          >
            Connect Account
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

