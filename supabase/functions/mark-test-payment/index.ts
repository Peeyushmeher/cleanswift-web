'use strict';

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface TestPaymentRequest {
  booking_id?: string;
  test_token?: string;
}

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(requestOrigin);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const enableTestPayments = Deno.env.get('ENABLE_TEST_PAYMENTS');
    if (enableTestPayments !== 'true') {
      return new Response(
        JSON.stringify({ error: 'Test payments are disabled on this environment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const secret = Deno.env.get('TEST_PAYMENT_SECRET');
    if (!secret) {
      console.error('TEST_PAYMENT_SECRET is not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let payload: TestPaymentRequest;
    try {
      payload = await req.json();
    } catch (error) {
      console.error('Failed to parse request body', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { booking_id, test_token } = payload;
    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing booking_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!test_token || test_token !== secret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase service credentials missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Transition booking status to paid using central state machine
    const { error: statusError } = await supabase.rpc('update_booking_status', {
      p_booking_id: booking_id,
      p_new_status: 'paid',
    });

    if (statusError) {
      console.error('Failed to update booking status via RPC', statusError);
      return new Response(
        JSON.stringify({ error: `Failed to update booking status: ${statusError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark payment status as paid for bookkeeping
    const { error: paymentError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        stripe_payment_intent_id: 'test-payment',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id);

    if (paymentError) {
      console.error('Failed to update booking payment status', paymentError);
      return new Response(
        JSON.stringify({ error: `Failed to update payment status: ${paymentError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ booking_id, status: 'paid', payment_status: 'paid' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unhandled error in mark-test-payment function', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

