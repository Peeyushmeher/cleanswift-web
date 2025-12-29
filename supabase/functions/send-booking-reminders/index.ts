// Supabase Edge Function: send-booking-reminders
// Purpose: Send reminder notifications to detailers for upcoming bookings
//
// This function should be called via a cron job (e.g., daily at 8 AM local time)
// It queries bookings scheduled for the next 24-48 hours and sends reminders
// based on each detailer's reminder_hours_before preference.
//
// Environment Variables Required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - Plus all variables required by send-detailer-notification

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface BookingReminder {
  booking_id: string;
  detailer_id: string;
  service_name: string;
  scheduled_date: string;
  scheduled_time_start: string;
  customer_name: string;
  city: string;
  address_line1: string;
  reminder_hours_before: number;
  hours_until_booking: number;
}

serve(async (req) => {
  console.log('=== send-booking-reminders Edge Function called ===');
  console.log('Method:', req.method);
  console.log('Time:', new Date().toISOString());
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  
  // Allow both GET and POST (GET for cron jobs, POST for manual triggers)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Query bookings that need reminders
    // We look for bookings:
    // 1. Status is 'accepted' (detailer has accepted the job)
    // 2. Scheduled for the next 48 hours
    // 3. Has an assigned detailer
    // 4. Hasn't already received a reminder (we'll check notification_logs)
    
    const now = new Date();
    const maxReminderWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours from now
    
    console.log('📅 Looking for bookings between now and:', maxReminderWindow.toISOString());
    
    // Get upcoming bookings with detailer preferences
    const { data: upcomingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        detailer_id,
        scheduled_date,
        scheduled_time_start,
        city,
        address_line1,
        services:service_id (name),
        detailers:detailer_id (
          id,
          profile_id,
          profiles:profile_id (full_name)
        ),
        users:user_id (full_name)
      `)
      .eq('status', 'accepted')
      .not('detailer_id', 'is', null)
      .gte('scheduled_date', now.toISOString().split('T')[0])
      .lte('scheduled_date', maxReminderWindow.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time_start', { ascending: true });
    
    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bookings', details: bookingsError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📋 Found ${upcomingBookings?.length || 0} upcoming bookings`);
    
    if (!upcomingBookings || upcomingBookings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No upcoming bookings to remind',
          reminders_sent: 0 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get notification preferences for all relevant detailers
    const detailerIds = [...new Set(upcomingBookings.map(b => b.detailer_id))];
    
    const { data: preferences, error: prefsError } = await supabase
      .from('detailer_notification_preferences')
      .select('detailer_id, reminder_hours_before, booking_reminder_sms, booking_reminder_email')
      .in('detailer_id', detailerIds);
    
    if (prefsError) {
      console.error('❌ Error fetching preferences:', prefsError);
    }
    
    // Create a map of preferences
    const prefsMap = new Map();
    preferences?.forEach(p => prefsMap.set(p.detailer_id, p));
    
    // Check which bookings have already received reminders
    const bookingIds = upcomingBookings.map(b => b.id);
    
    const { data: sentReminders, error: logsError } = await supabase
      .from('notification_logs')
      .select('metadata')
      .eq('notification_type', 'booking_reminder')
      .eq('status', 'sent')
      .filter('metadata->>booking_id', 'in', `(${bookingIds.map(id => `"${id}"`).join(',')})`);
    
    if (logsError) {
      console.log('⚠️ Could not check sent reminders, proceeding anyway:', logsError);
    }
    
    // Create set of booking IDs that already received reminders
    const sentBookingIds = new Set(
      sentReminders?.map(r => (r.metadata as { booking_id?: string })?.booking_id).filter(Boolean) || []
    );
    
    // Process each booking and determine if reminder should be sent
    const remindersToSend: BookingReminder[] = [];
    
    for (const booking of upcomingBookings) {
      // Skip if already sent
      if (sentBookingIds.has(booking.id)) {
        console.log(`⏭️ Skipping ${booking.id} - reminder already sent`);
        continue;
      }
      
      // Get preferences (default to 24 hours if not set)
      const prefs = prefsMap.get(booking.detailer_id) || { reminder_hours_before: 24 };
      
      // Calculate hours until booking
      const bookingDateTime = new Date(`${booking.scheduled_date}T${booking.scheduled_time_start}`);
      const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Check if we should send reminder based on preference
      // We send reminder when hours until booking is within the reminder window
      // and greater than 0 (booking hasn't started yet)
      if (hoursUntilBooking > 0 && hoursUntilBooking <= prefs.reminder_hours_before) {
        remindersToSend.push({
          booking_id: booking.id,
          detailer_id: booking.detailer_id,
          service_name: (booking.services as { name?: string })?.name || 'Auto Detailing',
          scheduled_date: booking.scheduled_date,
          scheduled_time_start: booking.scheduled_time_start,
          customer_name: (booking.users as { full_name?: string })?.full_name || 'Customer',
          city: booking.city,
          address_line1: booking.address_line1,
          reminder_hours_before: prefs.reminder_hours_before,
          hours_until_booking: hoursUntilBooking,
        });
      }
    }
    
    console.log(`📬 Sending ${remindersToSend.length} reminders`);
    
    // Send reminders by calling the send-detailer-notification function
    // Process in parallel batches for scalability (max 10 concurrent)
    const BATCH_SIZE = 10;
    const results: { booking_id: string; success: boolean; error?: string }[] = [];
    
    // Helper function to send a single reminder
    const sendReminder = async (reminder: BookingReminder): Promise<{ booking_id: string; success: boolean; error?: string }> => {
      try {
        // Format date and time for display
        const dateFormatted = new Date(reminder.scheduled_date).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        
        const timeFormatted = new Date(`2000-01-01T${reminder.scheduled_time_start}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        
        // Call the send-detailer-notification function
        const { error: invokeError } = await supabase.functions.invoke('send-detailer-notification', {
          body: {
            detailer_id: reminder.detailer_id,
            notification_type: 'booking_reminder',
            data: {
              booking_id: reminder.booking_id,
              service_name: reminder.service_name,
              scheduled_date: dateFormatted,
              scheduled_time: timeFormatted,
              customer_name: reminder.customer_name,
              location_city: reminder.city,
              location_address: `${reminder.address_line1}, ${reminder.city}`,
            },
          },
        });
        
        if (invokeError) {
          console.error(`❌ Failed to send reminder for ${reminder.booking_id}:`, invokeError);
          return { booking_id: reminder.booking_id, success: false, error: invokeError.message };
        } else {
          console.log(`✅ Reminder sent for ${reminder.booking_id}`);
          return { booking_id: reminder.booking_id, success: true };
        }
      } catch (error) {
        console.error(`❌ Error sending reminder for ${reminder.booking_id}:`, error);
        return { 
          booking_id: reminder.booking_id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    };
    
    // Process in batches for better scalability
    for (let i = 0; i < remindersToSend.length; i += BATCH_SIZE) {
      const batch = remindersToSend.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(remindersToSend.length / BATCH_SIZE)} (${batch.length} reminders)`);
      
      const batchResults = await Promise.allSettled(batch.map(sendReminder));
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ booking_id: 'unknown', success: false, error: result.reason?.message || 'Unknown error' });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`✅ Reminders complete: ${successCount} sent, ${failureCount} failed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: successCount,
        reminders_failed: failureCount,
        total_upcoming_bookings: upcomingBookings.length,
        results,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error processing reminders:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

