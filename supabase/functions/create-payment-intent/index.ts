// Supabase Edge Function: create-payment-intent
// Purpose: Create Stripe PaymentIntent for booking payments
//
// Security features:
// - Only accepts booking_id (amount computed server-side)
// - Validates booking ownership via RLS
// - Checks booking status allows payment
// - Implements idempotency (reuses existing PaymentIntent if present)
// - Stores payment intent ID back to booking

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentIntentRequest {
  booking_id: string;
}

interface PaymentIntentResponse {
  paymentIntentClientSecret: string;
  bookingId: string;
  amountCents: number;
  currency: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== create-payment-intent Edge Function called ===');
    console.log('Method:', req.method);

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let requestBody: PaymentIntentRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected JSON.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { booking_id } = requestBody;

    // Validate required fields
    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: booking_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
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

    console.log('Authenticated user:', user.id);

    // Verify booking exists, belongs to authenticated user, and is in a state that allows payment
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, user_id, total_amount, payment_status, stripe_payment_intent_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('Booking query error:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate booking ownership
    if (booking.user_id !== user.id) {
      console.error('Booking ownership mismatch:', { booking_user: booking.user_id, auth_user: user.id });
      return new Response(
        JSON.stringify({ error: 'Unauthorized. This booking does not belong to you.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate booking status allows payment
    // Allow 'unpaid', 'requires_payment', and 'processing' statuses
    // 'processing' allows retries if user cancelled mid-payment
    const allowedPaymentStatuses = ['unpaid', 'requires_payment', 'processing'];
    if (!allowedPaymentStatuses.includes(booking.payment_status)) {
      console.error('Booking payment status does not allow payment:', booking.payment_status);
      return new Response(
        JSON.stringify({
          error: `Payment not allowed for booking with status: ${booking.payment_status}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate total amount is positive
    if (!booking.total_amount || booking.total_amount <= 0) {
      console.error('Invalid booking total amount:', booking.total_amount);
      return new Response(
        JSON.stringify({ error: 'Booking has invalid total amount' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Compute amount in cents (from total_amount in dollars)
    const amountCents = Math.round(booking.total_amount * 100);

    // Initialize Stripe with secret key
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

    // IDEMPOTENCY: Check if booking already has a PaymentIntent
    let paymentIntent;
    if (booking.stripe_payment_intent_id) {
      console.log('Booking already has PaymentIntent, retrieving existing one:', booking.stripe_payment_intent_id);
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);

        // Validate the existing PaymentIntent matches the booking amount
        if (paymentIntent.amount !== amountCents) {
          console.warn(
            'Existing PaymentIntent amount mismatch. Creating new one.',
            { existing: paymentIntent.amount, expected: amountCents }
          );
          paymentIntent = null; // Will create a new one below
        } else {
          // Check PaymentIntent status
          const payableStatuses = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'];
          const finalStatuses = ['succeeded', 'canceled'];
          
          if (payableStatuses.includes(paymentIntent.status)) {
            // PaymentIntent is still payable, reuse it
            console.log('✅ Reusing existing PaymentIntent (status:', paymentIntent.status, ')');
          } else if (finalStatuses.includes(paymentIntent.status)) {
            // PaymentIntent is in a final state, create a new one
            console.log('PaymentIntent is in final state (', paymentIntent.status, '), creating new one');
            paymentIntent = null;
          } else {
            // Unknown status, reuse it
            console.log('Reusing PaymentIntent with status:', paymentIntent.status);
          }
        }
      } catch (retrieveError) {
        console.warn('Failed to retrieve existing PaymentIntent, creating new one:', retrieveError);
        // PaymentIntent might have been deleted or doesn't exist, create a new one
        paymentIntent = null;
      }
    }

    // Create new PaymentIntent if we don't have a valid existing one
    if (!paymentIntent) {
      console.log('Creating new PaymentIntent for booking:', booking_id);
      console.log('Amount:', booking.total_amount, 'CAD');
      console.log('Amount (cents):', amountCents);
      console.log('User ID:', booking.user_id);

      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: 'cad',
          automatic_payment_methods: {
            enabled: true,
          },
          metadata: {
            booking_id: booking_id,
            user_id: booking.user_id,
          },
          description: `CleanSwift Booking ${booking_id.slice(0, 8)}`,
        });

        console.log('✅ PaymentIntent created successfully');
        console.log('  PaymentIntent ID:', paymentIntent.id);
        console.log('  Status:', paymentIntent.status);
        console.log('  Amount:', paymentIntent.amount, 'cents');

        // Store payment intent ID back to booking
        const { error: updateError } = await supabaseClient
          .from('bookings')
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            payment_status: 'processing', // Update status to processing
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking_id);

        if (updateError) {
          console.error('Failed to update booking with payment intent ID:', updateError);
          // Don't fail the request - payment intent was created successfully
          // The booking update can be retried or handled separately
        } else {
          console.log('✅ Updated booking with payment intent ID');
        }
      } catch (stripeError) {
        console.error('Stripe API error:', stripeError);
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
        throw stripeError; // Re-throw if not a Stripe error
      }
    }

    // Validate that client_secret exists
    if (!paymentIntent.client_secret) {
      console.error('❌ PaymentIntent created but client_secret is missing!');
      return new Response(
        JSON.stringify({ error: 'PaymentIntent created but client_secret is missing' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const response: PaymentIntentResponse = {
      paymentIntentClientSecret: paymentIntent.client_secret,
      bookingId: booking_id,
      amountCents: amountCents,
      currency: 'cad',
    };

    console.log('✅ Returning response:', {
      bookingId: response.bookingId,
      amountCents: response.amountCents,
      currency: response.currency,
      hasClientSecret: !!response.paymentIntentClientSecret,
    });
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Unhandled error in create-payment-intent:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error type:', error.type);
      console.error('Stripe error code:', error.code);
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

    // Handle other known error types
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Returning error response:', errorMessage);

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
