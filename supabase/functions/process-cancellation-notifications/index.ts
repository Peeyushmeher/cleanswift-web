// Supabase Edge Function: process-cancellation-notifications
// Purpose: Process pending booking cancellation notifications from the queue
//
// This function should be called:
// 1. By a cron job (every few minutes) to process the queue
// 2. On-demand after a booking is cancelled
//
// It processes pending notifications from notification_logs table
// and calls send-detailer-notification to send SMS/Email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PendingNotification {
  log_id: string;
  detailer_id: string;
  booking_id: string;
  service_name: string;
  customer_name: string;
  scheduled_date: string;
  scheduled_time: string;
  city: string;
}

serve(async (req) => {
  console.log('=== process-cancellation-notifications Edge Function called ===');
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
    
    // Get pending cancellation notifications
    const { data: pendingNotifications, error: fetchError } = await supabase
      .rpc('get_pending_cancellation_notifications');
    
    if (fetchError) {
      console.error('❌ Error fetching pending notifications:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending notifications', details: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📋 Found ${pendingNotifications?.length || 0} pending cancellation notifications`);
    
    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending notifications to process',
          processed: 0 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Process notifications in parallel (max 5 concurrent for rate limiting)
    const BATCH_SIZE = 5;
    const results: { log_id: string; success: boolean; error?: string }[] = [];
    
    // Helper function to process a single notification
    const processNotification = async (notification: PendingNotification): Promise<{ log_id: string; success: boolean; error?: string }> => {
      console.log(`📤 Processing notification for booking ${notification.booking_id}`);
      
      try {
        // Call the send-detailer-notification function
        const { error: notifyError } = await supabase.functions.invoke('send-detailer-notification', {
          body: {
            detailer_id: notification.detailer_id,
            notification_type: 'booking_cancelled',
            data: {
              booking_id: notification.booking_id,
              service_name: notification.service_name,
              scheduled_date: notification.scheduled_date,
              scheduled_time: notification.scheduled_time,
              customer_name: notification.customer_name,
              location_city: notification.city,
            },
          },
        });
        
        if (notifyError) {
          console.error(`❌ Failed to send notification:`, notifyError);
          
          // Mark as failed
          await supabase.rpc('mark_cancellation_notification_processed', {
            p_log_id: notification.log_id,
            p_channel: 'error',
            p_recipient: 'unknown',
            p_status: 'failed',
            p_error_message: notifyError.message,
          });
          
          return { log_id: notification.log_id, success: false, error: notifyError.message };
        } else {
          console.log(`✅ Notification sent for ${notification.booking_id}`);
          
          // Mark this queue entry as processed
          await supabase.rpc('mark_cancellation_notification_processed', {
            p_log_id: notification.log_id,
            p_channel: 'processed',
            p_recipient: 'via send-detailer-notification',
            p_status: 'sent',
          });
          
          return { log_id: notification.log_id, success: true };
        }
      } catch (error) {
        console.error(`❌ Error processing notification for ${notification.booking_id}:`, error);
        
        // Mark as failed
        await supabase.rpc('mark_cancellation_notification_processed', {
          p_log_id: notification.log_id,
          p_channel: 'error',
          p_recipient: 'unknown',
          p_status: 'failed',
          p_error_message: error instanceof Error ? error.message : 'Unknown error',
        });
        
        return { 
          log_id: notification.log_id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    };
    
    // Process in batches for better scalability and rate limiting
    const notifications = pendingNotifications as PendingNotification[];
    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      const batch = notifications.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(notifications.length / BATCH_SIZE)} (${batch.length} notifications)`);
      
      const batchResults = await Promise.allSettled(batch.map(processNotification));
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ log_id: 'unknown', success: false, error: result.reason?.message || 'Unknown error' });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`✅ Processing complete: ${successCount} sent, ${failureCount} failed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingNotifications.length,
        sent: successCount,
        failed: failureCount,
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
    console.error('❌ Error processing notifications:', error);
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

