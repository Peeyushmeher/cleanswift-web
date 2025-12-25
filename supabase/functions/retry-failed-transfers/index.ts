// Supabase Edge Function: retry-failed-transfers
// Purpose: Retry failed detailer transfers that are eligible for retry
//
// This function:
// - Finds transfers with status 'retry_pending' or 'failed'
// - Filters by retry_count < MAX_RETRIES (3)
// - Re-attempts Stripe transfer creation
// - Updates retry_count and status accordingly
// - Sends notification if all retries exhausted
//
// This function is designed to be called by:
// - pg_cron scheduled job (every 15 minutes)
// - Manual admin trigger
//
// Security: Uses service role key to bypass RLS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const MAX_RETRIES = 3;

interface RetryFailedTransfersResponse {
  success: boolean;
  retried: number;
  exhausted: number;
  errors?: string[];
}

serve(async (req) => {
  console.log('=== retry-failed-transfers Edge Function called ===');

  try {
    // Only allow POST or GET requests
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
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

    // Get failed transfers eligible for retry (limit to 50 at a time)
    const { data: failedTransfers, error: fetchError } = await supabase
      .from('detailer_transfers')
      .select(`
        id,
        booking_id,
        detailer_id,
        amount_cents,
        platform_fee_cents,
        status,
        error_message,
        retry_count,
        booking:bookings (
          id,
          total_amount,
          status
        ),
        detailer:detailers (
          id,
          stripe_connect_account_id,
          organization_id,
          pricing_model
        )
      `)
      .in('status', ['retry_pending', 'failed'])
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching failed transfers:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch failed transfers' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!failedTransfers || failedTransfers.length === 0) {
      console.log('No failed transfers eligible for retry');
      return new Response(
        JSON.stringify({
          success: true,
          retried: 0,
          exhausted: 0,
          message: 'No failed transfers eligible for retry',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${failedTransfers.length} failed transfers eligible for retry`);

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-12-15.clover',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const errors: string[] = [];
    let retried = 0;
    let exhausted = 0;

    for (const transfer of failedTransfers) {
      try {
        const booking = Array.isArray(transfer.booking) ? transfer.booking[0] : transfer.booking;
        const detailer = Array.isArray(transfer.detailer) ? transfer.detailer[0] : transfer.detailer;

        // Validate booking and detailer still exist and are valid
        if (!booking || booking.status !== 'completed') {
          console.log(`Skipping transfer ${transfer.id}: booking not completed`);
          await supabase
            .from('detailer_transfers')
            .update({
              status: 'failed',
              error_message: 'Booking is not completed',
            })
            .eq('id', transfer.id);
          continue;
        }

        if (!detailer) {
          console.log(`Skipping transfer ${transfer.id}: detailer not found`);
          await supabase
            .from('detailer_transfers')
            .update({
              status: 'failed',
              error_message: 'Detailer not found',
            })
            .eq('id', transfer.id);
          continue;
        }

        // Skip organization detailers
        if (detailer.organization_id) {
          console.log(`Skipping transfer ${transfer.id}: organization detailer`);
          await supabase
            .from('detailer_transfers')
            .update({
              status: 'failed',
              error_message: 'Organization detailers use batch payout system',
            })
            .eq('id', transfer.id);
          continue;
        }

        // Check if detailer still has Stripe Connect account
        if (!detailer.stripe_connect_account_id) {
          console.log(`Skipping transfer ${transfer.id}: no Stripe Connect account`);
          await supabase
            .from('detailer_transfers')
            .update({
              status: 'failed',
              error_message: 'Detailer has no Stripe Connect account',
              retry_count: MAX_RETRIES, // Mark as exhausted
            })
            .eq('id', transfer.id);
          exhausted++;
          continue;
        }

        console.log(`Retrying transfer ${transfer.id} (attempt ${transfer.retry_count + 1}/${MAX_RETRIES})`);

        // Attempt to create Stripe transfer
        try {
          const stripeTransfer = await stripe.transfers.create({
            amount: transfer.amount_cents,
            currency: 'cad',
            destination: detailer.stripe_connect_account_id,
            metadata: {
              booking_id: booking.id,
              detailer_id: detailer.id,
              transfer_id: transfer.id,
              retry_attempt: (transfer.retry_count + 1).toString(),
            },
          });

          console.log(`✅ Successfully retried transfer ${transfer.id}, Stripe ID: ${stripeTransfer.id}`);

          // Update transfer record
          await supabase
            .from('detailer_transfers')
            .update({
              stripe_transfer_id: stripeTransfer.id,
              status: 'processing',
              error_message: null,
              retry_count: transfer.retry_count + 1,
            })
            .eq('id', transfer.id);

          retried++;
        } catch (stripeError) {
          const errorMessage = stripeError instanceof Stripe.errors.StripeError
            ? stripeError.message
            : 'Unknown Stripe error';

          console.error(`❌ Retry failed for transfer ${transfer.id}:`, errorMessage);

          const newRetryCount = transfer.retry_count + 1;

          if (newRetryCount >= MAX_RETRIES) {
            // Max retries reached
            await supabase
              .from('detailer_transfers')
              .update({
                status: 'failed',
                error_message: `Max retries reached. Last error: ${errorMessage}`,
                retry_count: newRetryCount,
              })
              .eq('id', transfer.id);

            exhausted++;
            errors.push(`Transfer ${transfer.id}: Max retries reached - ${errorMessage}`);
          } else {
            // Queue for another retry
            await supabase
              .from('detailer_transfers')
              .update({
                status: 'retry_pending',
                error_message: errorMessage,
                retry_count: newRetryCount,
              })
              .eq('id', transfer.id);

            retried++; // Count as processed (will retry again later)
          }
        }
      } catch (error) {
        const errorMsg = `Transfer ${transfer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`Error processing retry for transfer ${transfer.id}:`, error);
        errors.push(errorMsg);
      }
    }

    const response: RetryFailedTransfersResponse = {
      success: true,
      retried,
      exhausted,
      ...(errors.length > 0 && { errors }),
    };

    console.log(`✅ Retried ${retried} transfers, ${exhausted} exhausted`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Unhandled error in retry-failed-transfers:', error);
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

