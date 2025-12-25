import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="px-2 py-1 rounded-md text-xs font-medium bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/30">
      Active
    </span>
  ) : (
    <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
      Inactive
    </span>
  );
}

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  // Get platform settings - use direct query instead of RPC to avoid auth context issues
  const { data: settingsData } = await supabase
    .from('platform_settings')
    .select('key, value');
  
  // Convert array to object format (like get_platform_settings returns)
  const settings = settingsData?.reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {}) || {};

  // Get service areas
  const { data: serviceAreas } = await supabase.rpc('get_all_service_areas');

  // Server actions
  async function updateBookingRules(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const bookingRules = {
      minimum_notice_hours: parseInt(formData.get('minimum_notice_hours') as string),
      cancellation_cutoff_hours: parseInt(formData.get('cancellation_cutoff_hours') as string),
      max_advance_booking_days: parseInt(formData.get('max_advance_booking_days') as string),
      allow_same_day_booking: formData.get('allow_same_day_booking') === 'true',
    };

    await supabase.rpc('update_platform_setting', {
      p_key: 'booking_rules',
      p_value: bookingRules,
    });
    
    revalidatePath('/admin/settings');
  }

  async function updateNotificationSettings(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const notificationSettings = {
      send_booking_confirmation: formData.get('send_booking_confirmation') === 'true',
      send_detailer_assigned: formData.get('send_detailer_assigned') === 'true',
      send_booking_reminder: formData.get('send_booking_reminder') === 'true',
      reminder_hours_before: parseInt(formData.get('reminder_hours_before') as string),
    };

    await supabase.rpc('update_platform_setting', {
      p_key: 'notification_settings',
      p_value: notificationSettings,
    });
    
    revalidatePath('/admin/settings');
  }

  async function createServiceArea(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    await supabase.rpc('create_service_area', {
      p_city: formData.get('city') as string,
      p_province: formData.get('province') as string,
      p_tax_rate: parseFloat(formData.get('tax_rate') as string),
      p_timezone: formData.get('timezone') as string,
    });
    
    revalidatePath('/admin/settings');
  }

  async function toggleServiceArea(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const areaId = formData.get('area_id') as string;
    const currentStatus = formData.get('current_status') === 'true';

    await supabase.rpc('update_service_area', {
      p_service_area_id: areaId,
      p_updates: { is_active: !currentStatus },
    });
    
    revalidatePath('/admin/settings');
  }

  async function updateServiceArea(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    const areaId = formData.get('area_id') as string;

    await supabase.rpc('update_service_area', {
      p_service_area_id: areaId,
      p_updates: {
        tax_rate: parseFloat(formData.get('tax_rate') as string),
        timezone: formData.get('timezone') as string,
      },
    });
    
    revalidatePath('/admin/settings');
  }

  async function updatePlatformFee(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    // Verify user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Only admins can update platform settings');
    }
    
    const feePercentageStr = formData.get('platform_fee_percentage') as string;
    const feePercentage = parseFloat(feePercentageStr);
    
    if (isNaN(feePercentage) || feePercentage < 0 || feePercentage > 100) {
      throw new Error('Platform fee percentage must be between 0 and 100');
    }

    console.log('Updating platform fee to:', feePercentage, 'User ID:', user.id, 'Role:', profile.role);

    // Use direct database update instead of RPC function
    // The RPC function's auth.uid() context doesn't work correctly in server actions
    // This is safe because we've already verified the user is an admin above
    // RLS policies will also enforce admin-only access
    const { error: updateError } = await supabase
      .from('platform_settings')
      .update({ 
        value: feePercentage,
        updated_at: new Date().toISOString()
      })
      .eq('key', 'platform_fee_percentage');
    
    if (updateError) {
      console.error('Error updating platform fee:', updateError);
      throw new Error(`Failed to update platform fee: ${updateError.message}`);
    }
    
    console.log('Platform fee updated successfully to:', feePercentage);
    
    // Verify the update worked by checking the database directly (not using RPC)
    const { data: verifySetting, error: verifyError } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single();
    
    if (verifyError) {
      console.error('Error verifying update:', verifyError);
    } else {
      const updatedValue = typeof verifySetting.value === 'number' 
        ? verifySetting.value 
        : parseFloat(verifySetting.value as string);
      console.log('Verified platform fee value after update:', updatedValue, 'Type:', typeof updatedValue);
      
      // If the value didn't update correctly, log a warning
      if (updatedValue !== feePercentage) {
        console.warn(`Value mismatch! Expected ${feePercentage}, got ${updatedValue}`);
      }
    }
    
    revalidatePath('/admin/settings');
  }

  async function updateSubscriptionPrice(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    // Verify user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Only admins can update platform settings');
    }
    
    const priceStr = formData.get('subscription_monthly_price') as string;
    const price = parseFloat(priceStr);
    
    if (isNaN(price) || price <= 0 || price > 999) {
      throw new Error('Subscription price must be between 0.01 and 999');
    }

    console.log('Updating subscription price to:', price, 'User ID:', user.id);

    // First, create a new Stripe price via Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Server configuration error');
    }

    try {
      const functionUrl = `${supabaseUrl}/functions/v1/create-subscription-price`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ amount: price }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create Stripe price');
      }

      const result = await response.json();
      console.log('Created new Stripe price:', result.price_id);

      // Update subscription_monthly_price in platform_settings
      const { error: updateError } = await supabase
        .from('platform_settings')
        .update({
          value: price,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'subscription_monthly_price');
      
      if (updateError) {
        console.error('Error updating subscription monthly price:', updateError);
        throw new Error(`Failed to update subscription price: ${updateError.message}`);
      }
      
      console.log('Subscription price updated successfully to:', price);
    } catch (error) {
      console.error('Error updating subscription price:', error);
      throw error instanceof Error ? error : new Error('Failed to update subscription price');
    }
    
    revalidatePath('/admin/settings');
  }

  async function updateSubscriptionPlatformFee(formData: FormData) {
    'use server';
    const supabase = await createClient();
    
    // Verify user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Only admins can update platform settings');
    }
    
    const feePercentageStr = formData.get('subscription_platform_fee_percentage') as string;
    const feePercentage = parseFloat(feePercentageStr);
    
    if (isNaN(feePercentage) || feePercentage < 0 || feePercentage > 100) {
      throw new Error('Subscription platform fee percentage must be between 0 and 100');
    }

    console.log('Updating subscription platform fee to:', feePercentage, 'User ID:', user.id);

    const { error: updateError } = await supabase
      .from('platform_settings')
      .update({
        value: feePercentage,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'subscription_platform_fee_percentage');
    
    if (updateError) {
      console.error('Error updating subscription platform fee:', updateError);
      throw new Error(`Failed to update subscription platform fee: ${updateError.message}`);
    }
    
    console.log('Subscription platform fee updated successfully to:', feePercentage);
    
    revalidatePath('/admin/settings');
  }

  const bookingRules = settings?.booking_rules || {
    minimum_notice_hours: 24,
    cancellation_cutoff_hours: 4,
    max_advance_booking_days: 30,
    allow_same_day_booking: false,
  };

  const notificationSettings = settings?.notification_settings || {
    send_booking_confirmation: true,
    send_detailer_assigned: true,
    send_booking_reminder: true,
    reminder_hours_before: 24,
  };

  // The platform_fee_percentage is stored as a number in jsonb
  const platformFeePercentage = settings?.platform_fee_percentage 
    ? (typeof settings.platform_fee_percentage === 'number' 
        ? settings.platform_fee_percentage 
        : parseFloat(settings.platform_fee_percentage as string))
    : 15;

  // Subscription monthly price
  const subscriptionMonthlyPrice = settings?.subscription_monthly_price
    ? (typeof settings.subscription_monthly_price === 'number'
        ? settings.subscription_monthly_price
        : parseFloat(settings.subscription_monthly_price as string))
    : 29.99;

  // Subscription platform fee percentage
  const subscriptionPlatformFeePercentage = settings?.subscription_platform_fee_percentage
    ? (typeof settings.subscription_platform_fee_percentage === 'number'
        ? settings.subscription_platform_fee_percentage
        : parseFloat(settings.subscription_platform_fee_percentage as string))
    : 3;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-[#C6CFD9]">Configure platform settings and service areas</p>
      </div>

      {/* Platform Fee Setting */}
      <div className="mb-6 bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Percentage Model - Platform Fee
        </h2>
        <form action={updatePlatformFee} className="space-y-4" suppressHydrationWarning>
          <div>
            <label className="text-sm text-[#C6CFD9] mb-1 block">Platform Fee Percentage (%)</label>
            <input
              type="number"
              name="platform_fee_percentage"
              defaultValue={platformFeePercentage}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              suppressHydrationWarning
            />
            <p className="text-xs text-[#C6CFD9]/60 mt-1">
              The percentage of each booking that goes to the platform for detailers on the percentage model. This affects all future bookings.
            </p>
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
          >
            Save Platform Fee
          </button>
        </form>
      </div>

      {/* Subscription Model Settings */}
      <div className="mb-6 bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
          </svg>
          Subscription Model Settings
        </h2>
        <div className="space-y-6">
          {/* Subscription Monthly Price */}
          <form action={updateSubscriptionPrice} className="space-y-4" suppressHydrationWarning>
            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Monthly Subscription Price ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white">$</span>
                <input
                  type="number"
                  name="subscription_monthly_price"
                  defaultValue={subscriptionMonthlyPrice}
                  min="0.01"
                  max="999"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  suppressHydrationWarning
                />
              </div>
              <p className="text-xs text-[#C6CFD9]/60 mt-1">
                The monthly subscription price for detailers. This will create a new Stripe price for future subscriptions.
              </p>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
            >
              Save Subscription Price
            </button>
          </form>

          {/* Subscription Platform Fee */}
          <form action={updateSubscriptionPlatformFee} className="space-y-4" suppressHydrationWarning>
            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Platform Fee Percentage (%)</label>
              <input
                type="number"
                name="subscription_platform_fee_percentage"
                defaultValue={subscriptionPlatformFeePercentage}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                suppressHydrationWarning
              />
              <p className="text-xs text-[#C6CFD9]/60 mt-1">
                The percentage of each booking that goes to the platform for detailers on the subscription model (for payment processing only). This affects all future bookings.
              </p>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
            >
              Save Subscription Platform Fee
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Booking Rules */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            Booking Rules
          </h2>
          <form action={updateBookingRules} className="space-y-4" suppressHydrationWarning>
            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Minimum Notice (hours)</label>
              <input
                type="number"
                name="minimum_notice_hours"
                defaultValue={bookingRules.minimum_notice_hours}
                min="0"
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                suppressHydrationWarning
              />
              <p className="text-xs text-[#C6CFD9]/60 mt-1">How far in advance bookings must be made</p>
            </div>
            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Cancellation Cutoff (hours)</label>
              <input
                type="number"
                name="cancellation_cutoff_hours"
                defaultValue={bookingRules.cancellation_cutoff_hours}
                min="0"
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                suppressHydrationWarning
              />
              <p className="text-xs text-[#C6CFD9]/60 mt-1">Free cancellation window before appointment</p>
            </div>
            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Max Advance Booking (days)</label>
              <input
                type="number"
                name="max_advance_booking_days"
                defaultValue={bookingRules.max_advance_booking_days}
                min="1"
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                suppressHydrationWarning
              />
              <p className="text-xs text-[#C6CFD9]/60 mt-1">How far in the future customers can book</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="allow_same_day_booking"
                value="true"
                defaultChecked={bookingRules.allow_same_day_booking}
                className="w-4 h-4 rounded border-white/10 bg-[#050B12] text-[#32CE7A] focus:ring-[#32CE7A]/50"
                suppressHydrationWarning
              />
              <label className="text-sm text-white">Allow same-day booking</label>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
            >
              Save Booking Rules
            </button>
          </form>
        </div>

        {/* Notification Settings */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            Notifications
          </h2>
          <form action={updateNotificationSettings} className="space-y-4" suppressHydrationWarning>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="send_booking_confirmation"
                  value="true"
                  defaultChecked={notificationSettings.send_booking_confirmation}
                  className="w-4 h-4 rounded border-white/10 bg-[#050B12] text-[#32CE7A] focus:ring-[#32CE7A]/50"
                  suppressHydrationWarning
                />
                <label className="text-sm text-white">Send booking confirmation</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="send_detailer_assigned"
                  value="true"
                  defaultChecked={notificationSettings.send_detailer_assigned}
                  className="w-4 h-4 rounded border-white/10 bg-[#050B12] text-[#32CE7A] focus:ring-[#32CE7A]/50"
                  suppressHydrationWarning
                />
                <label className="text-sm text-white">Send detailer assignment notification</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="send_booking_reminder"
                  value="true"
                  defaultChecked={notificationSettings.send_booking_reminder}
                  className="w-4 h-4 rounded border-white/10 bg-[#050B12] text-[#32CE7A] focus:ring-[#32CE7A]/50"
                  suppressHydrationWarning
                />
                <label className="text-sm text-white">Send booking reminder</label>
              </div>
            </div>
            <div>
              <label className="text-sm text-[#C6CFD9] mb-1 block">Reminder Hours Before</label>
              <input
                type="number"
                name="reminder_hours_before"
                defaultValue={notificationSettings.reminder_hours_before}
                min="1"
                className="w-full px-3 py-2 bg-[#050B12] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
                suppressHydrationWarning
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
            >
              Save Notification Settings
            </button>
          </form>
        </div>
      </div>

      {/* Service Areas */}
      <div className="mt-6 bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          Service Areas
        </h2>

        {/* Add Service Area Form */}
        <form action={createServiceArea} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 bg-[#050B12] rounded-lg" suppressHydrationWarning>
          <div>
            <label className="text-sm text-[#C6CFD9] mb-1 block">City *</label>
            <input
              type="text"
              name="city"
              required
              className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              placeholder="City name"
              suppressHydrationWarning
            />
          </div>
          <div>
            <label className="text-sm text-[#C6CFD9] mb-1 block">Province *</label>
            <input
              type="text"
              name="province"
              required
              className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white placeholder-[#C6CFD9]/50 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              placeholder="Ontario"
              suppressHydrationWarning
            />
          </div>
          <div>
            <label className="text-sm text-[#C6CFD9] mb-1 block">Tax Rate</label>
            <input
              type="number"
              name="tax_rate"
              step="0.0001"
              defaultValue="0.13"
              className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              suppressHydrationWarning
            />
          </div>
          <div>
            <label className="text-sm text-[#C6CFD9] mb-1 block">Timezone</label>
            <select
              name="timezone"
              defaultValue="America/Toronto"
              className="w-full px-3 py-2 bg-[#0A1A2F] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
              suppressHydrationWarning
            >
              <option value="America/Toronto">America/Toronto</option>
              <option value="America/Vancouver">America/Vancouver</option>
              <option value="America/Edmonton">America/Edmonton</option>
              <option value="America/Montreal">America/Montreal</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-medium rounded-lg transition-colors"
            >
              Add Area
            </button>
          </div>
        </form>

        {/* Service Areas Table */}
        {!serviceAreas || serviceAreas.length === 0 ? (
          <div className="text-center text-[#C6CFD9] py-8">
            No service areas configured
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050B12] border-b border-white/10">
                <tr>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">City</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Province</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Tax Rate</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Timezone</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Bookings</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-[#C6CFD9] text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {serviceAreas.map((area: any) => (
                  <tr key={area.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{area.city}</td>
                    <td className="py-3 px-4 text-[#C6CFD9]">{area.province}</td>
                    <td className="py-3 px-4 text-white">{(area.tax_rate * 100).toFixed(2)}%</td>
                    <td className="py-3 px-4 text-[#C6CFD9] text-sm">{area.timezone}</td>
                    <td className="py-3 px-4 text-white">{area.booking_count}</td>
                    <td className="py-3 px-4">
                      <StatusBadge isActive={area.is_active} />
                    </td>
                    <td className="py-3 px-4">
                      <form action={toggleServiceArea} className="inline">
                        <input type="hidden" name="area_id" value={area.id} />
                        <input type="hidden" name="current_status" value={String(area.is_active)} />
                        <button
                          type="submit"
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            area.is_active
                              ? 'text-red-400 hover:bg-red-500/10'
                              : 'text-[#32CE7A] hover:bg-[#32CE7A]/10'
                          }`}
                        >
                          {area.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Info */}
      <div className="mt-6 bg-[#0A1A2F] border border-white/5 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Admin Information</h2>
        <div className="text-sm text-[#C6CFD9] space-y-2">
          <p>Platform Fee: <span className="text-white font-medium">{platformFeePercentage}%</span></p>
          <p>Currency: <span className="text-white font-medium">CAD</span></p>
          <p>Version: <span className="text-white font-medium">1.0.0</span></p>
        </div>
      </div>
    </div>
  );
}

