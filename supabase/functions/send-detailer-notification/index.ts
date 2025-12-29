// Supabase Edge Function: send-detailer-notification
// Purpose: Send SMS (Twilio) and Email (Resend) notifications to detailers
//
// Notification Types:
// - new_booking: When a new booking is offered/assigned to detailer
// - booking_cancelled: When a customer cancels a booking
// - booking_reminder: Reminder before scheduled booking
// - payout_processed: When weekly payout is processed
//
// Environment Variables Required:
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_PHONE_NUMBER_US (for US/Canada)
// - TWILIO_PHONE_NUMBER_UK (for UK)
// - RESEND_API_KEY
// - RESEND_FROM_EMAIL

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface NotificationRequest {
  detailer_id: string;
  notification_type: 'new_booking' | 'booking_cancelled' | 'booking_reminder' | 'payout_processed';
  data: {
    booking_id?: string;
    service_name?: string;
    scheduled_date?: string;
    scheduled_time?: string;
    customer_name?: string;
    location_city?: string;
    location_address?: string;
    amount?: number;
    week_start?: string;
    week_end?: string;
    total_jobs?: number;
  };
}

interface DetailerNotificationInfo {
  detailer_id: string;
  full_name: string;
  email: string;
  phone: string;
  sms_enabled: boolean;
  email_enabled: boolean;
  new_booking_sms: boolean;
  new_booking_email: boolean;
  booking_cancelled_sms: boolean;
  booking_cancelled_email: boolean;
  booking_reminder_sms: boolean;
  booking_reminder_email: boolean;
  payout_sms: boolean;
  payout_email: boolean;
  reminder_hours_before: number;
}

interface NotificationResult {
  sms_sent: boolean;
  email_sent: boolean;
  sms_provider_id?: string;
  email_provider_id?: string;
  sms_error?: string;
  email_error?: string;
}

// SMS Templates
function getSmsTemplate(type: string, data: NotificationRequest['data']): string {
  switch (type) {
    case 'new_booking':
      return `🚗 New job! ${data.service_name} on ${data.scheduled_date} at ${data.scheduled_time}. Location: ${data.location_city}. Check app to accept.`;
    
    case 'booking_cancelled':
      return `❌ Booking cancelled: ${data.service_name} on ${data.scheduled_date} at ${data.scheduled_time} has been cancelled.`;
    
    case 'booking_reminder':
      return `⏰ Reminder: You have ${data.service_name} tomorrow at ${data.scheduled_time} in ${data.location_city}. Check app for details.`;
    
    case 'payout_processed':
      return `💰 Payout of $${(data.amount! / 100).toFixed(2)} processed for ${data.week_start} - ${data.week_end} (${data.total_jobs} jobs).`;
    
    default:
      return 'You have a new notification from CleanSwift.';
  }
}

// Email Templates (HTML)
function getEmailTemplate(type: string, data: NotificationRequest['data'], detailerName: string): { subject: string; html: string } {
  const baseUrl = Deno.env.get('SITE_URL') || 'https://cleanswift.app';
  
  const headerStyle = `
    background: linear-gradient(135deg, #0A1A2F 0%, #1a3a5c 100%);
    padding: 30px;
    text-align: center;
  `;
  
  const buttonStyle = `
    display: inline-block;
    background: #32CE7A;
    color: #0A1A2F;
    padding: 14px 28px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: bold;
    margin-top: 20px;
  `;

  const wrapperStyle = `
    max-width: 600px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  switch (type) {
    case 'new_booking':
      return {
        subject: `🚗 New Job Offer: ${data.service_name} on ${data.scheduled_date}`,
        html: `
          <div style="${wrapperStyle}">
            <div style="${headerStyle}">
              <h1 style="color: #32CE7A; margin: 0; font-size: 24px;">New Job Offered!</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #333; font-size: 16px;">Hi ${detailerName},</p>
              <p style="color: #333; font-size: 16px;">A new job has been offered to you!</p>
              
              <div style="background: #f5f7fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0; color: #333;"><strong>Service:</strong> ${data.service_name}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${data.scheduled_date}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Time:</strong> ${data.scheduled_time}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Location:</strong> ${data.location_city}</p>
                ${data.customer_name ? `<p style="margin: 5px 0; color: #333;"><strong>Customer:</strong> ${data.customer_name}</p>` : ''}
              </div>
              
              <p style="color: #333; font-size: 16px;">Please accept or decline this job as soon as possible.</p>
              
              <div style="text-align: center;">
                <a href="${baseUrl}/detailer/pending" style="${buttonStyle}">View Job Details</a>
              </div>
            </div>
            <div style="background: #f5f7fa; padding: 20px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0;">CleanSwift - Mobile Auto Detailing</p>
            </div>
          </div>
        `
      };
    
    case 'booking_cancelled':
      return {
        subject: `❌ Booking Cancelled: ${data.service_name} on ${data.scheduled_date}`,
        html: `
          <div style="${wrapperStyle}">
            <div style="${headerStyle}">
              <h1 style="color: #ef4444; margin: 0; font-size: 24px;">Booking Cancelled</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #333; font-size: 16px;">Hi ${detailerName},</p>
              <p style="color: #333; font-size: 16px;">A booking has been cancelled by the customer.</p>
              
              <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <p style="margin: 5px 0; color: #333;"><strong>Service:</strong> ${data.service_name}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${data.scheduled_date}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Time:</strong> ${data.scheduled_time}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Location:</strong> ${data.location_city}</p>
              </div>
              
              <p style="color: #333; font-size: 16px;">This time slot is now available for other bookings.</p>
              
              <div style="text-align: center;">
                <a href="${baseUrl}/detailer/schedule" style="${buttonStyle}">View Schedule</a>
              </div>
            </div>
            <div style="background: #f5f7fa; padding: 20px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0;">CleanSwift - Mobile Auto Detailing</p>
            </div>
          </div>
        `
      };
    
    case 'booking_reminder':
      return {
        subject: `⏰ Reminder: ${data.service_name} Tomorrow at ${data.scheduled_time}`,
        html: `
          <div style="${wrapperStyle}">
            <div style="${headerStyle}">
              <h1 style="color: #32CE7A; margin: 0; font-size: 24px;">Upcoming Job Reminder</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #333; font-size: 16px;">Hi ${detailerName},</p>
              <p style="color: #333; font-size: 16px;">This is a reminder about your upcoming job tomorrow.</p>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #32CE7A;">
                <p style="margin: 5px 0; color: #333;"><strong>Service:</strong> ${data.service_name}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Date:</strong> ${data.scheduled_date}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Time:</strong> ${data.scheduled_time}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Location:</strong> ${data.location_address || data.location_city}</p>
                ${data.customer_name ? `<p style="margin: 5px 0; color: #333;"><strong>Customer:</strong> ${data.customer_name}</p>` : ''}
              </div>
              
              <p style="color: #333; font-size: 16px;">Make sure to arrive on time and contact the customer if needed.</p>
              
              <div style="text-align: center;">
                <a href="${baseUrl}/detailer/bookings/${data.booking_id}" style="${buttonStyle}">View Booking Details</a>
              </div>
            </div>
            <div style="background: #f5f7fa; padding: 20px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0;">CleanSwift - Mobile Auto Detailing</p>
            </div>
          </div>
        `
      };
    
    case 'payout_processed':
      return {
        subject: `💰 Payout Processed: $${(data.amount! / 100).toFixed(2)}`,
        html: `
          <div style="${wrapperStyle}">
            <div style="${headerStyle}">
              <h1 style="color: #32CE7A; margin: 0; font-size: 24px;">Payout Processed!</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #333; font-size: 16px;">Hi ${detailerName},</p>
              <p style="color: #333; font-size: 16px;">Great news! Your weekly payout has been processed.</p>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #32CE7A; font-size: 36px; font-weight: bold;">$${(data.amount! / 100).toFixed(2)}</p>
                <p style="margin: 10px 0 0 0; color: #666;">Week of ${data.week_start} - ${data.week_end}</p>
                <p style="margin: 5px 0 0 0; color: #666;">${data.total_jobs} completed job${data.total_jobs === 1 ? '' : 's'}</p>
              </div>
              
              <p style="color: #333; font-size: 16px;">The funds should arrive in your connected bank account within 2-3 business days.</p>
              
              <div style="text-align: center;">
                <a href="${baseUrl}/detailer/earnings" style="${buttonStyle}">View Earnings</a>
              </div>
            </div>
            <div style="background: #f5f7fa; padding: 20px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0;">CleanSwift - Mobile Auto Detailing</p>
            </div>
          </div>
        `
      };
    
    default:
      return {
        subject: 'Notification from CleanSwift',
        html: `
          <div style="${wrapperStyle}">
            <div style="${headerStyle}">
              <h1 style="color: #32CE7A; margin: 0; font-size: 24px;">CleanSwift Notification</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #333; font-size: 16px;">Hi ${detailerName},</p>
              <p style="color: #333; font-size: 16px;">You have a new notification. Please check the app for details.</p>
              <div style="text-align: center;">
                <a href="${baseUrl}/detailer/dashboard" style="${buttonStyle}">Open Dashboard</a>
              </div>
            </div>
            <div style="background: #f5f7fa; padding: 20px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0;">CleanSwift - Mobile Auto Detailing</p>
            </div>
          </div>
        `
      };
  }
}

// Format phone number to E.164 format and detect region
function formatPhoneNumber(phone: string): { formatted: string; region: 'US' | 'UK' | 'unknown' } {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If starts with +, keep it; otherwise assume it's a local number
  if (!cleaned.startsWith('+')) {
    // If 10 digits, assume US/Canada
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    }
    // If 11 digits starting with 1, assume US/Canada
    else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    }
    // If starts with 44, assume UK
    else if (cleaned.startsWith('44')) {
      cleaned = '+' + cleaned;
    }
  }
  
  // Determine region
  let region: 'US' | 'UK' | 'unknown' = 'unknown';
  if (cleaned.startsWith('+1')) {
    region = 'US'; // US or Canada
  } else if (cleaned.startsWith('+44')) {
    region = 'UK';
  }
  
  return { formatted: cleaned, region };
}

// Send SMS via Twilio
async function sendSms(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const phoneNumberUs = Deno.env.get('TWILIO_PHONE_NUMBER_US');
  const phoneNumberUk = Deno.env.get('TWILIO_PHONE_NUMBER_UK');
  
  // Debug logging
  console.log('🔍 Twilio Config Check:');
  console.log('  - TWILIO_ACCOUNT_SID exists:', !!accountSid, accountSid ? `(starts with ${accountSid.substring(0, 4)}...)` : '');
  console.log('  - TWILIO_AUTH_TOKEN exists:', !!authToken);
  console.log('  - TWILIO_PHONE_NUMBER_US exists:', !!phoneNumberUs, phoneNumberUs || '');
  
  if (!accountSid || !authToken) {
    console.error('❌ Twilio credentials not configured');
    return { success: false, error: 'Twilio credentials not configured' };
  }
  
  const { formatted, region } = formatPhoneNumber(phone);
  
  // Select the appropriate from number based on region
  let fromNumber = phoneNumberUs; // Default to US number
  if (region === 'UK' && phoneNumberUk) {
    fromNumber = phoneNumberUk;
  }
  
  if (!fromNumber) {
    console.error('❌ Twilio phone number not configured for region:', region);
    return { success: false, error: `Twilio phone number not configured for region: ${region}` };
  }
  
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: formatted,
          Body: message,
        }),
      }
    );
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SMS sent successfully:', data.sid);
      return { success: true, messageId: data.sid };
    } else {
      console.error('❌ Twilio API error:', data);
      return { success: false, error: data.message || 'Failed to send SMS' };
    }
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Send Email via Resend
async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@cleanswift.app';
  
  // Debug logging
  console.log('🔍 Resend Config Check:');
  console.log('  - RESEND_API_KEY exists:', !!apiKey, apiKey ? `(starts with ${apiKey.substring(0, 5)}...)` : '');
  console.log('  - RESEND_FROM_EMAIL:', fromEmail);
  
  if (!apiKey) {
    console.error('❌ Resend API key not configured');
    return { success: false, error: 'Resend API key not configured' };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `CleanSwift <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Email sent successfully:', data.id);
      return { success: true, emailId: data.id };
    } else {
      console.error('❌ Resend API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Check if notification should be sent based on preferences
function shouldSendNotification(
  prefs: DetailerNotificationInfo,
  type: string,
  channel: 'sms' | 'email'
): boolean {
  // Check global toggle first
  if (channel === 'sms' && !prefs.sms_enabled) return false;
  if (channel === 'email' && !prefs.email_enabled) return false;
  
  // Check per-type preference
  switch (type) {
    case 'new_booking':
      return channel === 'sms' ? prefs.new_booking_sms : prefs.new_booking_email;
    case 'booking_cancelled':
      return channel === 'sms' ? prefs.booking_cancelled_sms : prefs.booking_cancelled_email;
    case 'booking_reminder':
      return channel === 'sms' ? prefs.booking_reminder_sms : prefs.booking_reminder_email;
    case 'payout_processed':
      return channel === 'sms' ? prefs.payout_sms : prefs.payout_email;
    default:
      return true;
  }
}

serve(async (req) => {
  console.log('=== send-detailer-notification Edge Function called ===');
  console.log('Method:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Parse request body
    const body: NotificationRequest = await req.json();
    console.log('Notification request:', JSON.stringify(body, null, 2));
    
    const { detailer_id, notification_type, data } = body;
    
    if (!detailer_id || !notification_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: detailer_id, notification_type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
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
    
    // Get detailer notification info
    const { data: detailerInfo, error: detailerError } = await supabase
      .rpc('get_detailer_notification_info', { p_detailer_id: detailer_id });
    
    if (detailerError || !detailerInfo || detailerInfo.length === 0) {
      console.error('❌ Failed to get detailer info:', detailerError);
      return new Response(
        JSON.stringify({ error: 'Detailer not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const prefs = detailerInfo[0] as DetailerNotificationInfo;
    console.log('Detailer info:', prefs.full_name, prefs.email, prefs.phone);
    
    const result: NotificationResult = {
      sms_sent: false,
      email_sent: false,
    };
    
    // Prepare notification content
    const smsMessage = getSmsTemplate(notification_type, data);
    const emailContent = getEmailTemplate(notification_type, data, prefs.full_name);
    
    // Send SMS and Email in PARALLEL for better performance
    const sendSmsIfEnabled = async () => {
      if (prefs.phone && shouldSendNotification(prefs, notification_type, 'sms')) {
        console.log('📱 Sending SMS to:', prefs.phone);
        const smsResult = await sendSms(prefs.phone, smsMessage);
        result.sms_sent = smsResult.success;
        result.sms_provider_id = smsResult.messageId;
        result.sms_error = smsResult.error;
        
        // Log the notification attempt
        await supabase.rpc('log_notification', {
          p_detailer_id: detailer_id,
          p_notification_type: notification_type,
          p_channel: 'sms',
          p_recipient: prefs.phone,
          p_status: smsResult.success ? 'sent' : 'failed',
          p_provider_id: smsResult.messageId || null,
          p_error_message: smsResult.error || null,
          p_metadata: data,
        });
      } else {
        console.log('📱 SMS skipped - disabled or no phone number');
      }
    };
    
    const sendEmailIfEnabled = async () => {
      if (prefs.email && shouldSendNotification(prefs, notification_type, 'email')) {
        console.log('📧 Sending email to:', prefs.email);
        const emailResult = await sendEmail(prefs.email, emailContent.subject, emailContent.html);
        result.email_sent = emailResult.success;
        result.email_provider_id = emailResult.emailId;
        result.email_error = emailResult.error;
        
        // Log the notification attempt
        await supabase.rpc('log_notification', {
          p_detailer_id: detailer_id,
          p_notification_type: notification_type,
          p_channel: 'email',
          p_recipient: prefs.email,
          p_status: emailResult.success ? 'sent' : 'failed',
          p_provider_id: emailResult.emailId || null,
          p_error_message: emailResult.error || null,
          p_metadata: data,
        });
      } else {
        console.log('📧 Email skipped - disabled or no email address');
      }
    };
    
    // Execute SMS and Email sends in parallel
    await Promise.allSettled([sendSmsIfEnabled(), sendEmailIfEnabled()]);
    
    console.log('✅ Notification processing complete:', result);
    
    return new Response(
      JSON.stringify({
        success: true,
        ...result,
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
    console.error('❌ Error processing notification:', error);
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

