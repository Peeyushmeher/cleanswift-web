'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AvatarUpload from '@/components/detailer/AvatarUpload';

interface SettingsPageClientProps {
  profile: any;
  serviceAreas: any[];
  notificationSettings: any;
  detailer?: any;
  detailerNotificationPrefs?: any;
}

export default function SettingsPageClient({
  profile,
  serviceAreas,
  notificationSettings,
  detailer,
  detailerNotificationPrefs,
}: SettingsPageClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSaving, setIsSaving] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState<number>(29.99);
  const [platformFeePercentage, setPlatformFeePercentage] = useState<number>(15);

  // Fetch current pricing information
  useEffect(() => {
    async function fetchPricing() {
      try {
        // Fetch subscription monthly price
        const { data: subscriptionPriceData } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'subscription_monthly_price')
          .maybeSingle();
        
        if (subscriptionPriceData?.value) {
          const price = typeof subscriptionPriceData.value === 'number' 
            ? subscriptionPriceData.value 
            : parseFloat(String(subscriptionPriceData.value)) || 29.99;
          setSubscriptionPrice(price);
        }

        // Fetch platform fee percentage
        const { data: feeData } = await supabase.rpc('get_platform_fee_percentage');
        if (feeData !== null && feeData !== undefined) {
          setPlatformFeePercentage(parseFloat(String(feeData)) || 15);
        }
      } catch (error) {
        console.error('Error fetching pricing information:', error);
        // Use defaults if fetch fails
      }
    }

    fetchPricing();
  }, [supabase]);

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(detailer?.avatar_url || null);

  // Detailer-specific notification preferences (SMS/Email per event)
  const [notifPrefs, setNotifPrefs] = useState({
    sms_enabled: detailerNotificationPrefs?.sms_enabled ?? true,
    email_enabled: detailerNotificationPrefs?.email_enabled ?? true,
    new_booking_sms: detailerNotificationPrefs?.new_booking_sms ?? true,
    new_booking_email: detailerNotificationPrefs?.new_booking_email ?? true,
    booking_cancelled_sms: detailerNotificationPrefs?.booking_cancelled_sms ?? true,
    booking_cancelled_email: detailerNotificationPrefs?.booking_cancelled_email ?? true,
    booking_reminder_sms: detailerNotificationPrefs?.booking_reminder_sms ?? true,
    booking_reminder_email: detailerNotificationPrefs?.booking_reminder_email ?? true,
    payout_sms: detailerNotificationPrefs?.payout_sms ?? true,
    payout_email: detailerNotificationPrefs?.payout_email ?? true,
    reminder_hours_before: detailerNotificationPrefs?.reminder_hours_before ?? 24,
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

      // Update detailer notification preferences (SMS/Email per event)
      if (detailer?.id) {
        await supabase
          .from('detailer_notification_preferences')
          .upsert({
            detailer_id: detailer.id,
            sms_enabled: notifPrefs.sms_enabled,
            email_enabled: notifPrefs.email_enabled,
            new_booking_sms: notifPrefs.new_booking_sms,
            new_booking_email: notifPrefs.new_booking_email,
            booking_cancelled_sms: notifPrefs.booking_cancelled_sms,
            booking_cancelled_email: notifPrefs.booking_cancelled_email,
            booking_reminder_sms: notifPrefs.booking_reminder_sms,
            booking_reminder_email: notifPrefs.booking_reminder_email,
            payout_sms: notifPrefs.payout_sms,
            payout_email: notifPrefs.payout_email,
            reminder_hours_before: notifPrefs.reminder_hours_before,
          }, {
            onConflict: 'detailer_id',
          });
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
          {/* Avatar Upload */}
          <div>
            <label className="block text-sm font-medium text-[#C6CFD9] mb-2">
              Profile Picture
            </label>
            <AvatarUpload
              profileId={profile.id}
              currentAvatarUrl={avatarUrl}
              fullName={formData.full_name || profile.full_name || ''}
              onAvatarUpdated={(newUrl) => {
                setAvatarUrl(newUrl);
                // Refresh the page to show updated avatar
                router.refresh();
              }}
            />
          </div>
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
        
        {/* Global Toggles */}
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-medium text-[#C6CFD9] mb-2">Global Settings</h3>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-white">SMS Notifications</span>
              <p className="text-xs text-[#C6CFD9] mt-0.5">Receive text messages for job updates</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={notifPrefs.sms_enabled}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, sms_enabled: e.target.checked })}
                suppressHydrationWarning
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#050B12] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#32CE7A]"></div>
            </div>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-white">Email Notifications</span>
              <p className="text-xs text-[#C6CFD9] mt-0.5">Receive emails for job updates</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={notifPrefs.email_enabled}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, email_enabled: e.target.checked })}
                suppressHydrationWarning
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#050B12] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#32CE7A]"></div>
            </div>
          </label>
        </div>

        {/* Per-Event Notifications */}
        <div className="border-t border-white/5 pt-6">
          <h3 className="text-sm font-medium text-[#C6CFD9] mb-4">Event Notifications</h3>
          
          {/* New Booking */}
          <div className="mb-6 p-4 bg-[#050B12] rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🚗</span>
              <span className="text-white font-medium">New Booking Offers</span>
            </div>
            <p className="text-xs text-[#C6CFD9] mb-3">Get notified when a new job is offered to you</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.new_booking_sms}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, new_booking_sms: e.target.checked })}
                  disabled={!notifPrefs.sms_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.sms_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>SMS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.new_booking_email}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, new_booking_email: e.target.checked })}
                  disabled={!notifPrefs.email_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.email_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>Email</span>
              </label>
            </div>
          </div>

          {/* Booking Cancelled */}
          <div className="mb-6 p-4 bg-[#050B12] rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">❌</span>
              <span className="text-white font-medium">Booking Cancellations</span>
            </div>
            <p className="text-xs text-[#C6CFD9] mb-3">Get notified when a customer cancels a booking</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.booking_cancelled_sms}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, booking_cancelled_sms: e.target.checked })}
                  disabled={!notifPrefs.sms_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.sms_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>SMS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.booking_cancelled_email}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, booking_cancelled_email: e.target.checked })}
                  disabled={!notifPrefs.email_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.email_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>Email</span>
              </label>
            </div>
          </div>

          {/* Booking Reminder */}
          <div className="mb-6 p-4 bg-[#050B12] rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⏰</span>
              <span className="text-white font-medium">Upcoming Job Reminders</span>
            </div>
            <p className="text-xs text-[#C6CFD9] mb-3">Get reminded before your scheduled jobs</p>
            <div className="flex gap-6 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.booking_reminder_sms}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, booking_reminder_sms: e.target.checked })}
                  disabled={!notifPrefs.sms_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.sms_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>SMS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.booking_reminder_email}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, booking_reminder_email: e.target.checked })}
                  disabled={!notifPrefs.email_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.email_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>Email</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#C6CFD9]">Remind me</label>
              <select
                value={notifPrefs.reminder_hours_before}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, reminder_hours_before: parseInt(e.target.value) })}
                className="px-2 py-1 bg-[#0A1A2F] border border-white/10 rounded text-white text-sm focus:outline-none focus:border-[#32CE7A]/40"
              >
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
              <span className="text-xs text-[#C6CFD9]">before the job</span>
            </div>
          </div>

          {/* Payout Processed */}
          <div className="p-4 bg-[#050B12] rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💰</span>
              <span className="text-white font-medium">Payout Notifications</span>
            </div>
            <p className="text-xs text-[#C6CFD9] mb-3">Get notified when your weekly payout is processed</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.payout_sms}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, payout_sms: e.target.checked })}
                  disabled={!notifPrefs.sms_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.sms_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>SMS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.payout_email}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, payout_email: e.target.checked })}
                  disabled={!notifPrefs.email_enabled}
                  suppressHydrationWarning
                  className="w-4 h-4 rounded border-white/20 bg-[#0A1A2F] text-[#32CE7A] focus:ring-[#32CE7A] focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-sm ${!notifPrefs.email_enabled ? 'text-[#C6CFD9]/50' : 'text-[#C6CFD9]'}`}>Email</span>
              </label>
            </div>
          </div>
        </div>

        {/* Phone number notice */}
        {!profile.phone && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-300">
              <strong>Note:</strong> Add your phone number above to receive SMS notifications.
            </p>
          </div>
        )}
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
                  ? `Monthly Subscription ($${subscriptionPrice.toFixed(2)}/month)` 
                  : `Pay Per Booking (${platformFeePercentage}% platform fee)`}
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
                  if (!confirm(`Are you sure you want to switch to Monthly Subscription? This will start a $${subscriptionPrice.toFixed(2)}/month charge.`)) {
                    return;
                  }
                  try {
                    const response = await fetch('/api/detailer/switch-pricing-model', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pricing_model: 'subscription' }),
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                      // Wait a moment for database update to complete
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      // If payment is required, redirect to payment page
                      if (data.requiresPayment) {
                        if (confirm('Subscription created successfully! You need to complete payment setup to activate it. Redirect to payment page now?')) {
                          window.location.href = data.paymentUrl || '/detailer/subscription/payment';
                        } else {
                          // Still refresh the page to show updated pricing model
                          window.location.href = '/detailer/settings';
                        }
                      } else {
                        // Force a hard refresh to ensure server component reloads with new data
                        window.location.href = '/detailer/settings';
                      }
                    } else {
                      // Enhanced error message display
                      const errorMessage = data.error || 'Failed to update pricing model';
                      const errorDetails = data.details ? `\n\nDetails: ${data.details}` : '';
                      alert(errorMessage + errorDetails);
                    }
                  } catch (error) {
                    console.error('Error switching pricing model:', error);
                    alert('Failed to update pricing model. Please check your connection and try again.');
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
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                      // Wait a moment for database update to complete
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      // Force a hard refresh to ensure server component reloads with new data
                      window.location.href = '/detailer/settings';
                    } else {
                      alert(data.error || 'Failed to update pricing model');
                    }
                  } catch (error) {
                    console.error('Error switching pricing model:', error);
                    alert('Failed to update pricing model. Please check your connection and try again.');
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

