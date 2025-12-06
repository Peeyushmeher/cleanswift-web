'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SettingsPageClientProps {
  profile: any;
  serviceAreas: any[];
  notificationSettings: any;
  detailer?: any;
}

export default function SettingsPageClient({
  profile,
  serviceAreas,
  notificationSettings,
  detailer,
}: SettingsPageClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSaving, setIsSaving] = useState(false);

  // Check for OAuth callback parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      // Refresh the page to show updated connection status
      router.refresh();
      // Remove query parameter
      router.replace('/detailer/settings');
    }
  }, [router]);

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

      {/* Pricing Model */}
      {detailer && (
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pricing Model</h2>
          <div className="space-y-4">
            <div>
              <p className="text-[#C6CFD9] mb-2">Current Model</p>
              <p className="text-white font-medium">
                {detailer?.pricing_model === 'subscription' 
                  ? 'Monthly Subscription ($29.99/month)' 
                  : 'Pay Per Booking (15% platform fee)'}
              </p>
              {detailer?.stripe_subscription_id && (
                <p className="text-sm text-[#C6CFD9] mt-1">
                  Subscription Active
                </p>
              )}
            </div>
            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <p className="text-sm text-cyan-300">
                <strong>Note:</strong> Changing your pricing model will affect future bookings. 
                If switching to subscription, a monthly charge will begin. 
                If switching from subscription, your current subscription will be cancelled.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!detailer) return;
                  // Prevent clicking if already on this model
                  if (detailer.pricing_model === 'subscription') {
                    return;
                  }
                  if (!confirm('Are you sure you want to switch to Monthly Subscription? This will start a $29.99/month charge.')) {
                    return;
                  }
                  try {
                    const response = await fetch('/api/detailer/switch-pricing-model', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pricing_model: 'subscription' }),
                    });
                    if (response.ok) {
                      router.refresh();
                      alert('Pricing model updated successfully!');
                    } else {
                      const error = await response.json();
                      alert(error.error || 'Failed to update pricing model');
                    }
                  } catch (error) {
                    console.error('Error switching pricing model:', error);
                    alert('Failed to update pricing model');
                  }
                }}
                disabled={!detailer || detailer.pricing_model === 'subscription'}
                className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Switch to Subscription
              </button>
              <button
                onClick={async () => {
                  if (!detailer) return;
                  // Prevent clicking if already on this model
                  const currentModel = detailer.pricing_model || 'percentage'; // Default to percentage if null
                  if (currentModel === 'percentage') {
                    return;
                  }
                  if (!confirm('Are you sure you want to switch to Pay Per Booking? Your current subscription will be cancelled.')) {
                    return;
                  }
                  try {
                    const response = await fetch('/api/detailer/switch-pricing-model', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pricing_model: 'percentage' }),
                    });
                    if (response.ok) {
                      router.refresh();
                      alert('Pricing model updated successfully!');
                    } else {
                      const error = await response.json();
                      alert(error.error || 'Failed to update pricing model');
                    }
                  } catch (error) {
                    console.error('Error switching pricing model:', error);
                    alert('Failed to update pricing model');
                  }
                }}
                disabled={!detailer || detailer.pricing_model === 'percentage' || !detailer.pricing_model}
                className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Switch to Pay Per Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Connect Status */}
      {detailer && (
      <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Payment Account</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#C6CFD9]">Stripe Connect Account</p>
            <p className="text-sm mt-1">
              {detailer?.stripe_connect_account_id ? (
                <span className="text-[#32CE7A]">Connected</span>
              ) : (
                <span className="text-yellow-400">Not Connected</span>
              )}
            </p>
            {detailer?.stripe_connect_account_id && (
                <a
                  href={`https://dashboard.stripe.com/connect/accounts/${detailer?.stripe_connect_account_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#32CE7A] hover:text-[#6FF0C4] mt-1 inline-flex items-center gap-1"
                >
                  View in Stripe
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
          </div>
          {detailer?.stripe_connect_account_id ? (
            <Link
              href="/detailer/stripe-connect"
              className="px-4 py-2 bg-[#050B12] border border-white/5 hover:border-white/10 text-[#C6CFD9] rounded-lg transition-colors"
            >
              Manage Account
            </Link>
          ) : (
            <Link
              href="/detailer/stripe-connect"
              className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white rounded-lg transition-colors"
          >
            Connect Account
            </Link>
          )}
        </div>
        {!detailer?.stripe_connect_account_id && (
            <p className="text-xs text-[#C6CFD9]/60 mt-3">
              Connect your Stripe account to receive payouts for completed jobs
            </p>
          )}
      </div>
      )}

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

