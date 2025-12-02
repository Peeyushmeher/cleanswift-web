// Supabase Edge Function: handle-stripe-webhook
// Purpose: Process Stripe webhook events for payment status updates
//
// Security features:
// - Validates Stripe webhook signature using STRIPE_WEBHOOK_SECRET
// - Uses service role key to bypass RLS (webhook is backend-only)
// - Idempotent operations (safe to retry)
// - Updates bookings and payments tables based on PaymentIntent status
//
// Handles events:
// - payment_intent.succeeded: Mark booking as paid, create payment record
// - payment_intent.payment_failed: Mark payment as failed
// - payment_intent.canceled: Mark payment as failed/unpaid

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Stripe.PaymentIntent;
  };
}

serve(async (req) => {
  console.log('=== handle-stripe-webhook Edge Function called ===');
  console.log('Method:', req.method);

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Get Stripe signature from headers
    const stripeSignature = req.headers.get('Stripe-Signature');
    if (!stripeSignature) {
      console.error('❌ Missing Stripe-Signature header');
      return new Response(
        JSON.stringify({ error: 'Missing Stripe-Signature header' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get webhook secret from environment
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Read raw request body (required for signature verification)
    const rawBody = await req.text();
    if (!rawBody) {
      console.error('❌ Empty request body');
      return new Response(
        JSON.stringify({ error: 'Empty request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Stripe client for signature verification
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        stripeSignature,
        webhookSecret
      );
      console.log('✅ Webhook signature verified');
      console.log('Event type:', event.type);
      console.log('Event ID:', event.id);
    } catch (err) {
      console.error('⚠️  Webhook signature verification failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${errorMessage}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Process event based on type
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata?.booking_id;
    const userId = paymentIntent.metadata?.user_id;

    console.log('PaymentIntent ID:', paymentIntent.id);
    console.log('Booking ID from metadata:', bookingId);
    console.log('User ID from metadata:', userId);
    console.log('PaymentIntent status:', paymentIntent.status);
    console.log('Amount:', paymentIntent.amount, 'cents');
    console.log('Currency:', paymentIntent.currency);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(supabase, paymentIntent, bookingId, userId);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(supabase, paymentIntent, bookingId, userId);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(supabase, paymentIntent, bookingId, userId);
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
        // Return 200 to acknowledge receipt (Stripe won't retry)
        return new Response(
          JSON.stringify({ received: true, event_type: event.type }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
    }

    // Success response
    return new Response(
      JSON.stringify({ received: true, event_type: event.type }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Unhandled error in handle-stripe-webhook:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));

    // Return 200 to prevent Stripe from retrying on unexpected errors
    // (We log the error for debugging, but don't want infinite retries)
    return new Response(
      JSON.stringify({
        received: true,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Handle payment_intent.succeeded event
 * - Update booking: payment_status = 'paid', status = 'scheduled' (or keep existing)
 * - Upsert payment record with status = 'paid'
 */
async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent,
  bookingId: string | undefined,
  userId: string | undefined
) {
  console.log('🟢 Processing payment_intent.succeeded');

  if (!bookingId) {
    console.error('⚠️  payment_intent.succeeded without booking_id in metadata');
    return; // Return early, but don't fail (Stripe won't retry)
  }

  // Fetch booking to verify it exists
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, payment_status, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('⚠️  Booking not found:', bookingId, bookingError);
    return; // Return early, but don't fail
  }

  console.log('✅ Found booking:', bookingId);
  console.log('Current payment_status:', booking.payment_status);
  console.log('Current status:', booking.status);

  // Update booking payment_status and stripe_payment_intent_id directly
  // (These don't go through the state machine)
  const updateData: {
    payment_status: string;
    stripe_payment_intent_id: string;
    updated_at: string;
  } = {
    payment_status: 'paid',
    stripe_payment_intent_id: paymentIntent.id,
    updated_at: new Date().toISOString(),
  };

  const { error: updatePaymentError } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', bookingId);

  if (updatePaymentError) {
    console.error('❌ Failed to update booking payment_status:', updatePaymentError);
    // Don't throw - we'll still try to update status and create payment record
  } else {
    console.log('✅ Updated booking payment_status to "paid"');
  }

  // Update booking status using the state machine function
  // Only update status if it's in a payment-required state
  // System calls (webhook) can transition: requires_payment -> paid
  if (booking.status === 'requires_payment') {
    const { data: updatedBooking, error: updateStatusError } = await supabase
      .rpc('update_booking_status', {
        p_booking_id: bookingId,
        p_new_status: 'paid',
      });

    if (updateStatusError) {
      console.error('❌ Failed to update booking status via RPC:', updateStatusError);
      // Don't throw - payment_status was updated successfully
    } else {
      console.log('✅ Updated booking status to "paid" via state machine');
    }
  } else {
    console.log(`ℹ️  Booking status is "${booking.status}", not updating via state machine`);
  }

  // Upsert payment record
  // Use booking_id as the conflict key (one payment per booking)
  const { error: paymentError } = await supabase
    .from('payments')
    .upsert(
      {
        booking_id: bookingId,
        amount_cents: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        status: 'paid',
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: paymentIntent.latest_charge as string | null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'booking_id',
      }
    );

  if (paymentError) {
    console.error('❌ Failed to upsert payment record:', paymentError);
    // Don't throw - booking was updated successfully
  } else {
    console.log('✅ Upserted payment record');
  }

  console.log('✅ Successfully processed payment_intent.succeeded');
}

/**
 * Handle payment_intent.payment_failed event
 * - Update booking: payment_status = 'failed'
 * - Update payment record: status = 'failed'
 */
async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent,
  bookingId: string | undefined,
  userId: string | undefined
) {
  console.log('🔴 Processing payment_intent.payment_failed');

  if (!bookingId) {
    console.error('⚠️  payment_intent.payment_failed without booking_id in metadata');
    return;
  }

  // Fetch booking to verify it exists
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, payment_status, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('⚠️  Booking not found:', bookingId, bookingError);
    return;
  }

  console.log('✅ Found booking:', bookingId);

  // Update booking payment_status to 'failed'
  const { error: updateBookingError } = await supabase
    .from('bookings')
    .update({
      payment_status: 'failed',
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: new Date().toISOString(),
      // Keep existing status (don't change booking.status)
    })
    .eq('id', bookingId);

  if (updateBookingError) {
    console.error('❌ Failed to update booking:', updateBookingError);
  } else {
    console.log('✅ Updated booking payment_status to "failed"');
  }

  // Upsert payment record with failed status
  const { error: paymentError } = await supabase
    .from('payments')
    .upsert(
      {
        booking_id: bookingId,
        amount_cents: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        status: 'failed',
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'booking_id',
      }
    );

  if (paymentError) {
    console.error('❌ Failed to upsert payment record:', paymentError);
  } else {
    console.log('✅ Upserted payment record with failed status');
  }

  console.log('✅ Successfully processed payment_intent.payment_failed');
}

/**
 * Handle payment_intent.canceled event
 * - Update booking: payment_status = 'unpaid' or 'failed'
 * - Update payment record: status = 'failed'
 */
async function handlePaymentIntentCanceled(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent,
  bookingId: string | undefined,
  userId: string | undefined
) {
  console.log('🟡 Processing payment_intent.canceled');

  if (!bookingId) {
    console.error('⚠️  payment_intent.canceled without booking_id in metadata');
    return;
  }

  // Fetch booking to verify it exists
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, payment_status, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('⚠️  Booking not found:', bookingId, bookingError);
    return;
  }

  console.log('✅ Found booking:', bookingId);

  // Update booking payment_status to 'unpaid' (allows retry)
  const { error: updateBookingError } = await supabase
    .from('bookings')
    .update({
      payment_status: 'unpaid',
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: new Date().toISOString(),
      // Keep existing status (don't change booking.status)
    })
    .eq('id', bookingId);

  if (updateBookingError) {
    console.error('❌ Failed to update booking:', updateBookingError);
  } else {
    console.log('✅ Updated booking payment_status to "unpaid"');
  }

  // Upsert payment record with failed status (canceled is treated as failed)
  const { error: paymentError } = await supabase
    .from('payments')
    .upsert(
      {
        booking_id: bookingId,
        amount_cents: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        status: 'failed',
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'booking_id',
      }
    );

  if (paymentError) {
    console.error('❌ Failed to upsert payment record:', paymentError);
  } else {
    console.log('✅ Upserted payment record with failed status');
  }

  console.log('✅ Successfully processed payment_intent.canceled');
}

