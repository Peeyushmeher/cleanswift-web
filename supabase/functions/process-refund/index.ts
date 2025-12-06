// Supabase Edge Function: process-refund
// Purpose: Process refund requests via Stripe API
//
// Security features:
// - Only accessible by admins
// - Validates refund request exists and is approved
// - Validates booking has a PaymentIntent
// - Creates refund via Stripe API
// - Updates refund request and booking status
// - Logs admin action

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

// Get allowed origins from environment variable or use default
// Format: comma-separated list of origins (e.g., "https://app.example.com,https://www.example.com")
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOriginsEnv) {
    const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim());
    // If request origin is in allowed list, use it; otherwise use first allowed origin
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      return requestOrigin;
    }
    return allowedOrigins[0] || '*';
  }
  // Fallback: allow same origin or use wildcard (less secure but functional)
  return requestOrigin || '*';
};

const getCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
});

interface RefundRequest {
  refund_request_id: string;
}

interface RefundResponse {
  success: boolean;
  refund_id?: string;
  amount_refunded?: number;
  error?: string;
}

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(requestOrigin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== process-refund Edge Function called ===');

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let requestBody: RefundRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected JSON.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { refund_request_id } = requestBody;

    if (!refund_request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: refund_request_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // First, verify the caller is an admin using anon key with auth header
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const authClient = createClient(supabaseUrl, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Admin access required.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Admin verified:', user.id);

    // Use service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get refund request
    const { data: refundRequest, error: refundError } = await supabase
      .from('refund_requests')
      .select(`
        id,
        booking_id,
        amount_cents,
        reason,
        status,
        bookings (
          id,
          stripe_payment_intent_id,
          payment_status,
          total_amount
        )
      `)
      .eq('id', refund_request_id)
      .single();

    if (refundError || !refundRequest) {
      console.error('Refund request not found:', refundError);
      return new Response(
        JSON.stringify({ error: 'Refund request not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate refund request status
    if (refundRequest.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: `Refund request status is ${refundRequest.status}, must be approved` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const booking = refundRequest.bookings as any;

    // Validate booking has a PaymentIntent
    if (!booking?.stripe_payment_intent_id) {
      return new Response(
        JSON.stringify({ error: 'Booking has no associated Stripe PaymentIntent' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate booking payment status
    if (booking.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: `Booking payment status is ${booking.payment_status}, cannot refund` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    console.log('Creating Stripe refund for PaymentIntent:', booking.stripe_payment_intent_id);
    console.log('Refund amount (cents):', refundRequest.amount_cents);

    // Create refund via Stripe
    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: refundRequest.amount_cents,
        reason: 'requested_by_customer',
        metadata: {
          refund_request_id: refund_request_id,
          booking_id: refundRequest.booking_id,
          admin_id: user.id,
          reason: refundRequest.reason,
        },
      });

      console.log('✅ Stripe refund created:', stripeRefund.id);
      console.log('  Amount:', stripeRefund.amount);
      console.log('  Status:', stripeRefund.status);
    } catch (stripeError) {
      console.error('Stripe refund error:', stripeError);
      if (stripeError instanceof Stripe.errors.StripeError) {
        return new Response(
          JSON.stringify({
            error: `Stripe error: ${stripeError.message}`,
            code: stripeError.type,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      throw stripeError;
    }

    // Update refund request with Stripe refund ID
    const { error: updateRefundError } = await supabase
      .from('refund_requests')
      .update({
        status: 'processed',
        stripe_refund_id: stripeRefund.id,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', refund_request_id);

    if (updateRefundError) {
      console.error('Failed to update refund request:', updateRefundError);
      // Don't fail - refund was processed
    }

    // Update booking payment status
    const isFullRefund = refundRequest.amount_cents >= (booking.total_amount * 100);
    const { error: updateBookingError } = await supabase
      .from('bookings')
      .update({
        payment_status: isFullRefund ? 'refunded' : 'paid', // Keep as paid for partial refunds
        updated_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.booking_id);

    if (updateBookingError) {
      console.error('Failed to update booking:', updateBookingError);
    }

    // Log admin action
    await supabase
      .from('admin_action_logs')
      .insert({
        admin_id: user.id,
        action_type: 'process_refund',
        entity_type: 'refund_request',
        entity_id: refund_request_id,
        metadata: {
          stripe_refund_id: stripeRefund.id,
          amount_cents: refundRequest.amount_cents,
          booking_id: refundRequest.booking_id,
        },
      });

    const response: RefundResponse = {
      success: true,
      refund_id: stripeRefund.id,
      amount_refunded: stripeRefund.amount,
    };

    console.log('✅ Refund processed successfully');

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Unhandled error in process-refund:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({
          error: `Payment service error: ${error.message}`,
          code: error.type,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

