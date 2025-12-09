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

    // Get webhook secrets from environment (support multiple endpoints)
    // STRIPE_WEBHOOK_SECRET: For regular payment events
    // STRIPE_CONNECT_WEBHOOK_SECRET: For Stripe Connect transfer events (optional)
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const connectWebhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET');
    
    if (!webhookSecret && !connectWebhookSecret) {
      console.error('❌ No webhook secrets configured');
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

    // Verify webhook signature (try both secrets if both are configured)
    let event: Stripe.Event;
    let verified = false;
    
    // Try regular webhook secret first
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          stripeSignature,
          webhookSecret
        );
        console.log('✅ Webhook signature verified with STRIPE_WEBHOOK_SECRET');
        verified = true;
      } catch (err) {
        console.log('⚠️  Regular webhook secret failed, trying Connect secret...');
      }
    }
    
    // Try Connect webhook secret if regular one failed or doesn't exist
    if (!verified && connectWebhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          stripeSignature,
          connectWebhookSecret
        );
        console.log('✅ Webhook signature verified with STRIPE_CONNECT_WEBHOOK_SECRET');
        verified = true;
      } catch (err) {
        console.error('⚠️  Connect webhook secret also failed');
      }
    }
    
    if (!verified) {
      console.error('❌ Webhook signature verification failed with all configured secrets');
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    console.log('Event type:', event.type);
    console.log('Event ID:', event.id);

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
    switch (event.type) {
      case 'payment_intent.succeeded':
        {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const bookingId = paymentIntent.metadata?.booking_id;
          const userId = paymentIntent.metadata?.user_id;
          await handlePaymentIntentSucceeded(supabase, paymentIntent, bookingId, userId);
        }
        break;

      case 'payment_intent.payment_failed':
        {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const bookingId = paymentIntent.metadata?.booking_id;
          const userId = paymentIntent.metadata?.user_id;
          await handlePaymentIntentFailed(supabase, paymentIntent, bookingId, userId);
        }
        break;

      case 'payment_intent.canceled':
        {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const bookingId = paymentIntent.metadata?.booking_id;
          const userId = paymentIntent.metadata?.user_id;
          await handlePaymentIntentCanceled(supabase, paymentIntent, bookingId, userId);
        }
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(supabase, subscription);
        }
        break;

      case 'customer.subscription.deleted':
        {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(supabase, subscription);
        }
        break;

      case 'invoice.payment_succeeded':
        {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaymentSucceeded(supabase, invoice);
        }
        break;

      case 'invoice.payment_failed':
        {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaymentFailed(supabase, invoice);
        }
        break;

      case 'transfer.created':
        {
          const transfer = event.data.object as Stripe.Transfer;
          await handleTransferCreated(supabase, transfer);
        }
        break;

      case 'transfer.paid':
        {
          const transfer = event.data.object as Stripe.Transfer;
          await handleTransferPaid(supabase, transfer);
        }
        break;

      case 'transfer.failed':
        {
          const transfer = event.data.object as Stripe.Transfer;
          await handleTransferFailed(supabase, transfer);
        }
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
      
      // Immediately call auto-assign function to assign detailer and set status to 'offered'
      // This ensures it happens synchronously instead of relying on triggers
      const { data: assignedDetailerId, error: assignError } = await supabase
        .rpc('auto_assign_booking', {
          p_booking_id: bookingId,
        });

      if (assignError) {
        console.error('❌ Failed to auto-assign detailer:', assignError);
        // Don't throw - booking is still paid, can be assigned manually later
      } else if (assignedDetailerId) {
        console.log(`✅ Auto-assigned booking to detailer ${assignedDetailerId}, status should be "offered"`);
        
        // Verify the status was updated to 'offered'
        const { data: finalBooking } = await supabase
          .from('bookings')
          .select('status, detailer_id')
          .eq('id', bookingId)
          .single();
        
        if (finalBooking) {
          if (finalBooking.status === 'offered') {
            console.log('✅ Booking status correctly set to "offered"');
          } else {
            console.warn(`⚠️  Booking has detailer but status is "${finalBooking.status}" instead of "offered" - fixing...`);
            // Fix the status if it's still 'paid'
            if (finalBooking.status === 'paid') {
              await supabase
                .from('bookings')
                .update({ status: 'offered' })
                .eq('id', bookingId);
              console.log('✅ Fixed booking status to "offered"');
            }
          }
        }
      } else {
        console.log('ℹ️  No available detailer found for auto-assignment (booking remains "paid" and unassigned)');
      }
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

/**
 * Handle customer.subscription.created and customer.subscription.updated events
 * - Update detailer's stripe_subscription_id if not already set
 * - Update subscription status if needed
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  console.log('🟢 Processing customer.subscription.updated/created');
  console.log('Subscription ID:', subscription.id);
  console.log('Customer ID:', subscription.customer);
  console.log('Status:', subscription.status);

  const detailerId = subscription.metadata?.detailer_id;
  if (!detailerId) {
    console.log('ℹ️  Subscription does not have detailer_id in metadata, skipping');
    return;
  }

  // Update detailer with subscription ID if not already set
  const { error: updateError } = await supabase
    .from('detailers')
    .update({
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', detailerId)
    .is('stripe_subscription_id', null); // Only update if not already set

  if (updateError) {
    console.error('❌ Failed to update detailer subscription:', updateError);
  } else {
    console.log('✅ Updated detailer subscription ID');
  }
}

/**
 * Handle customer.subscription.deleted event
 * - Clear stripe_subscription_id from detailer record
 * - Optionally handle subscription cancellation logic
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  console.log('🔴 Processing customer.subscription.deleted');
  console.log('Subscription ID:', subscription.id);
  console.log('Customer ID:', subscription.customer);

  const detailerId = subscription.metadata?.detailer_id;
  if (!detailerId) {
    console.log('ℹ️  Subscription does not have detailer_id in metadata, skipping');
    return;
  }

  // Clear subscription ID from detailer
  const { error: updateError } = await supabase
    .from('detailers')
    .update({
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', detailerId);

  if (updateError) {
    console.error('❌ Failed to clear detailer subscription:', updateError);
  } else {
    console.log('✅ Cleared detailer subscription ID');
  }
}

/**
 * Handle invoice.payment_succeeded event
 * - Log successful subscription payment
 * - Optionally update detailer status or send notifications
 */
async function handleInvoicePaymentSucceeded(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  console.log('🟢 Processing invoice.payment_succeeded');
  console.log('Invoice ID:', invoice.id);
  console.log('Subscription ID:', invoice.subscription);
  console.log('Amount:', invoice.amount_paid, 'cents');

  const subscriptionId = typeof invoice.subscription === 'string' 
    ? invoice.subscription 
    : invoice.subscription?.id;

  if (!subscriptionId) {
    console.log('ℹ️  Invoice does not have subscription, skipping');
    return;
  }

  // Find detailer by subscription ID
  const { data: detailer, error: detailerError } = await supabase
    .from('detailers')
    .select('id, full_name')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (detailerError || !detailer) {
    console.log('ℹ️  Detailer not found for subscription:', subscriptionId);
    return;
  }

  console.log(`✅ Subscription payment succeeded for detailer: ${detailer.full_name} (${detailer.id})`);
  // Additional logic can be added here (e.g., notifications, logging)
}

/**
 * Handle invoice.payment_failed event
 * - Log failed subscription payment
 * - Optionally update detailer status or send notifications
 */
async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  console.log('🔴 Processing invoice.payment_failed');
  console.log('Invoice ID:', invoice.id);
  console.log('Subscription ID:', invoice.subscription);
  console.log('Amount:', invoice.amount_due, 'cents');

  const subscriptionId = typeof invoice.subscription === 'string' 
    ? invoice.subscription 
    : invoice.subscription?.id;

  if (!subscriptionId) {
    console.log('ℹ️  Invoice does not have subscription, skipping');
    return;
  }

  // Find detailer by subscription ID
  const { data: detailer, error: detailerError } = await supabase
    .from('detailers')
    .select('id, full_name')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (detailerError || !detailer) {
    console.log('ℹ️  Detailer not found for subscription:', subscriptionId);
    return;
  }

  console.log(`⚠️  Subscription payment failed for detailer: ${detailer.full_name} (${detailer.id})`);
  // Additional logic can be added here (e.g., notifications, status updates)
}

/**
 * Handle transfer.created event
 * - Update transfer status to 'processing'
 */
async function handleTransferCreated(
  supabase: ReturnType<typeof createClient>,
  transfer: Stripe.Transfer
) {
  console.log('🟢 Processing transfer.created');
  console.log('Transfer ID:', transfer.id);
  console.log('Amount:', transfer.amount, 'cents');
  console.log('Destination:', transfer.destination);

  const transferId = transfer.metadata?.transfer_id;
  if (!transferId) {
    console.log('ℹ️  Transfer does not have transfer_id in metadata, skipping');
    return;
  }

  // Update transfer record status to 'processing'
  const { error: updateError } = await supabase
    .from('detailer_transfers')
    .update({
      status: 'processing',
      stripe_transfer_id: transfer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId);

  if (updateError) {
    console.error('❌ Failed to update transfer status:', updateError);
  } else {
    console.log('✅ Updated transfer status to "processing"');
  }
}

/**
 * Handle transfer.paid event
 * - Update transfer status to 'succeeded'
 */
async function handleTransferPaid(
  supabase: ReturnType<typeof createClient>,
  transfer: Stripe.Transfer
) {
  console.log('🟢 Processing transfer.paid');
  console.log('Transfer ID:', transfer.id);
  console.log('Amount:', transfer.amount, 'cents');

  const transferId = transfer.metadata?.transfer_id;
  if (!transferId) {
    // Try to find by stripe_transfer_id if metadata doesn't have transfer_id
    const { data: transferRecord, error: findError } = await supabase
      .from('detailer_transfers')
      .select('id')
      .eq('stripe_transfer_id', transfer.id)
      .single();

    if (findError || !transferRecord) {
      console.log('ℹ️  Transfer record not found for Stripe transfer:', transfer.id);
      return;
    }

    // Update using found transfer record ID
    const { error: updateError } = await supabase
      .from('detailer_transfers')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferRecord.id);

    if (updateError) {
      console.error('❌ Failed to update transfer status:', updateError);
    } else {
      console.log('✅ Updated transfer status to "succeeded"');
    }
    return;
  }

  // Update transfer record status to 'succeeded'
  const { error: updateError } = await supabase
    .from('detailer_transfers')
    .update({
      status: 'succeeded',
      stripe_transfer_id: transfer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId);

  if (updateError) {
    console.error('❌ Failed to update transfer status:', updateError);
  } else {
    console.log('✅ Updated transfer status to "succeeded"');
  }
}

/**
 * Handle transfer.failed event
 * - Update transfer status to 'failed' or 'retry_pending' based on retry count
 */
async function handleTransferFailed(
  supabase: ReturnType<typeof createClient>,
  transfer: Stripe.Transfer
) {
  console.log('🔴 Processing transfer.failed');
  console.log('Transfer ID:', transfer.id);
  console.log('Failure code:', transfer.failure_code);
  console.log('Failure message:', transfer.failure_message);

  const transferId = transfer.metadata?.transfer_id;
  if (!transferId) {
    // Try to find by stripe_transfer_id
    const { data: transferRecord, error: findError } = await supabase
      .from('detailer_transfers')
      .select('id, retry_count')
      .eq('stripe_transfer_id', transfer.id)
      .single();

    if (findError || !transferRecord) {
      console.log('ℹ️  Transfer record not found for Stripe transfer:', transfer.id);
      return;
    }

    const errorMessage = transfer.failure_message || transfer.failure_code || 'Transfer failed';
    const newRetryCount = (transferRecord.retry_count || 0) + 1;
    const MAX_RETRIES = 3;

    // Update transfer record
    const { error: updateError } = await supabase
      .from('detailer_transfers')
      .update({
        status: newRetryCount < MAX_RETRIES ? 'retry_pending' : 'failed',
        error_message: errorMessage,
        retry_count: newRetryCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferRecord.id);

    if (updateError) {
      console.error('❌ Failed to update transfer status:', updateError);
    } else {
      console.log(`✅ Updated transfer status to "${newRetryCount < MAX_RETRIES ? 'retry_pending' : 'failed'}"`);
    }
    return;
  }

  // Get current transfer record to check retry count
  const { data: transferRecord, error: fetchError } = await supabase
    .from('detailer_transfers')
    .select('id, retry_count')
    .eq('id', transferId)
    .single();

  if (fetchError || !transferRecord) {
    console.error('⚠️  Transfer record not found:', transferId);
    return;
  }

  const errorMessage = transfer.failure_message || transfer.failure_code || 'Transfer failed';
  const newRetryCount = (transferRecord.retry_count || 0) + 1;
  const MAX_RETRIES = 3;

  // Update transfer record
  const { error: updateError } = await supabase
    .from('detailer_transfers')
    .update({
      status: newRetryCount < MAX_RETRIES ? 'retry_pending' : 'failed',
      error_message: errorMessage,
      retry_count: newRetryCount,
      stripe_transfer_id: transfer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId);

  if (updateError) {
    console.error('❌ Failed to update transfer status:', updateError);
  } else {
    console.log(`✅ Updated transfer status to "${newRetryCount < MAX_RETRIES ? 'retry_pending' : 'failed'}" (retry ${newRetryCount}/${MAX_RETRIES})`);
  }
}

