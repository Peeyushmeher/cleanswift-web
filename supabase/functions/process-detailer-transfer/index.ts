// Supabase Edge Function: process-detailer-transfer
// Purpose: Process Stripe Connect transfer to solo detailer when booking is completed
//
// Security features:
// - Uses service role key (bypasses RLS)
// - Validates booking is completed and has detailer assigned
// - Only processes solo detailers (not organization members)
// - Verifies Stripe Connect account exists
// - Handles errors gracefully with retry mechanism
// - Prevents duplicate transfers

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

interface ProcessTransferRequest {
  booking_id: string;
}

interface ProcessTransferResponse {
  success: boolean;
  transfer_id?: string;
  stripe_transfer_id?: string;
  amount_cents?: number;
  error?: string;
}

serve(async (req) => {
  console.log('=== process-detailer-transfer Edge Function called ===');
  console.log('Method:', req.method);

  try {
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

    // Parse request body
    let requestBody: ProcessTransferRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected JSON.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { booking_id } = requestBody;

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: booking_id' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Validate booking exists and is completed
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, detailer_id, total_amount, service_price, organization_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (booking.status !== 'completed') {
      console.log('Booking is not completed, status:', booking.status);
      return new Response(
        JSON.stringify({ error: `Booking is not completed. Current status: ${booking.status}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!booking.detailer_id) {
      console.log('Booking has no detailer assigned');
      return new Response(
        JSON.stringify({ error: 'Booking has no detailer assigned' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if transfer already exists
    const { data: existingTransfer } = await supabase
      .from('detailer_transfers')
      .select('id, status, stripe_transfer_id, amount_cents, platform_fee_cents')
      .eq('booking_id', booking_id)
      .single();

    if (existingTransfer) {
      // If transfer is already succeeded or processing, return early
      if (existingTransfer.status === 'succeeded' || existingTransfer.status === 'processing') {
        console.log('Transfer already processed for this booking:', existingTransfer.id);
        return new Response(
          JSON.stringify({
            success: true,
            transfer_id: existingTransfer.id,
            stripe_transfer_id: existingTransfer.stripe_transfer_id,
            message: 'Transfer already processed',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      // If transfer is pending or retry_pending, continue to process it
      if (existingTransfer.status === 'pending' || existingTransfer.status === 'retry_pending') {
        console.log('Processing existing pending transfer:', existingTransfer.id);
        // Continue with processing below - we'll use the existing transfer record
      } else {
        // Transfer is in failed state, we can retry
        console.log('Retrying failed transfer:', existingTransfer.id);
      }
    }

    // Get detailer info
    const { data: detailer, error: detailerError } = await supabase
      .from('detailers')
      .select('id, stripe_connect_account_id, organization_id, pricing_model')
      .eq('id', booking.detailer_id)
      .single();

    if (detailerError || !detailer) {
      console.error('Detailer not found:', detailerError);
      return new Response(
        JSON.stringify({ error: 'Detailer not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Only process solo detailers (skip organization detailers)
    if (detailer.organization_id) {
      console.log('Detailer is part of organization, skipping solo transfer');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Organization detailers use batch payout system',
          message: 'Skipped - organization detailer',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if detailer has Stripe Connect account
    if (!detailer.stripe_connect_account_id) {
      console.log('Detailer has no Stripe Connect account');
      // Create transfer record with failed status
      const { data: failedTransfer } = await supabase
        .from('detailer_transfers')
        .insert({
          booking_id: booking_id,
          detailer_id: detailer.id,
          amount_cents: 0,
          platform_fee_cents: 0,
          status: 'failed',
          error_message: 'Detailer has no Stripe Connect account connected',
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Detailer has no Stripe Connect account connected',
          transfer_id: failedTransfer?.id,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate payout amount
    // Get platform fee percentage based on detailer's pricing model
    let platformFeePercentage = 15; // Default
    if (detailer.pricing_model === 'subscription') {
      // Get subscription platform fee
      const { data: subFeeSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'subscription_platform_fee_percentage')
        .maybeSingle();
      
      if (subFeeSetting) {
        const value = typeof subFeeSetting.value === 'number' 
          ? subFeeSetting.value 
          : parseFloat(String(subFeeSetting.value)) || 3;
        platformFeePercentage = value;
      } else {
        platformFeePercentage = 3; // Default subscription fee
      }
    } else {
      // Get standard platform fee
      const { data: feeData } = await supabase.rpc('get_platform_fee_percentage');
      if (feeData) {
        platformFeePercentage = parseFloat(feeData) || 15;
      }
    }

    // Platform fee is calculated on service_price (not total_amount which includes Stripe fees)
    // The customer pays Stripe fees, so detailer payout is based on service_price only
    const servicePrice = parseFloat(booking.service_price || booking.total_amount || '0');
    const platformFee = (servicePrice * platformFeePercentage) / 100;
    const payoutAmount = servicePrice - platformFee;
    const amountCents = Math.round(payoutAmount * 100);
    const platformFeeCents = Math.round(platformFee * 100);

    console.log('Calculated payout:', {
      total_amount: booking.total_amount,
      platform_fee_percentage: platformFeePercentage,
      platform_fee: platformFee,
      payout_amount: payoutAmount,
      amount_cents: amountCents,
    });

    // Use existing transfer record if it exists, otherwise create new one
    let transferRecord;
    if (existingTransfer) {
      // Update existing transfer record with calculated amounts (in case they changed)
      const { data: updatedTransfer, error: updateError } = await supabase
        .from('detailer_transfers')
        .update({
          amount_cents: amountCents,
          platform_fee_cents: platformFeeCents,
          status: 'pending', // Reset to pending if it was retry_pending
          error_message: null, // Clear any previous errors
        })
        .eq('id', existingTransfer.id)
        .select()
        .single();

      if (updateError || !updatedTransfer) {
        console.error('Failed to update transfer record:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update transfer record' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      transferRecord = updatedTransfer;
      console.log('Updated existing transfer record:', transferRecord.id);
    } else {
      // Create new transfer record with pending status
      const { data: newTransfer, error: transferInsertError } = await supabase
        .from('detailer_transfers')
        .insert({
          booking_id: booking_id,
          detailer_id: detailer.id,
          amount_cents: amountCents,
          platform_fee_cents: platformFeeCents,
          status: 'pending',
        })
        .select()
        .single();

      if (transferInsertError || !newTransfer) {
        console.error('Failed to create transfer record:', transferInsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create transfer record' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      transferRecord = newTransfer;
      console.log('Created transfer record:', transferRecord.id);
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      // Update transfer record to failed
      await supabase
        .from('detailer_transfers')
        .update({
          status: 'failed',
          error_message: 'Stripe not configured',
        })
        .eq('id', transferRecord.id);

      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
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

    // Create Stripe transfer
    try {
      const stripeTransfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'cad',
        destination: detailer.stripe_connect_account_id,
        metadata: {
          booking_id: booking.id,
          detailer_id: detailer.id,
          transfer_id: transferRecord.id,
        },
      });

      console.log('✅ Stripe transfer created:', stripeTransfer.id);

      // Update transfer record with Stripe transfer ID and status
      const { error: updateError } = await supabase
        .from('detailer_transfers')
        .update({
          stripe_transfer_id: stripeTransfer.id,
          status: 'processing', // Will be updated to 'succeeded' via webhook
        })
        .eq('id', transferRecord.id);

      if (updateError) {
        console.error('Failed to update transfer record:', updateError);
        // Don't fail - transfer was created successfully
      }

      const response: ProcessTransferResponse = {
        success: true,
        transfer_id: transferRecord.id,
        stripe_transfer_id: stripeTransfer.id,
        amount_cents: amountCents,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (stripeError) {
      console.error('Stripe transfer error:', stripeError);
      
      const errorMessage = stripeError instanceof Stripe.errors.StripeError
        ? stripeError.message
        : 'Unknown Stripe error';

      // Update transfer record to retry_pending
      await supabase
        .from('detailer_transfers')
        .update({
          status: 'retry_pending',
          error_message: errorMessage,
          retry_count: 1,
        })
        .eq('id', transferRecord.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Stripe error: ${errorMessage}`,
          transfer_id: transferRecord.id,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('❌ Unhandled error in process-detailer-transfer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

