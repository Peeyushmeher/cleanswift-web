// @ts-nocheck
// TypeScript errors in this file are expected - this runs in Deno, not Node.js
// The code works correctly when deployed to Supabase Edge Functions

// Supabase Edge Function: sync-transfer-status
// Purpose: Sync transfer statuses from Stripe API for transfers stuck in 'processing' status
//
// This function:
// 1. Queries all transfers with status 'processing' that have stripe_transfer_id
// 2. Groups by weekly_payout_batch_id to minimize Stripe API calls
// 3. Checks Stripe API for current transfer status
// 4. Updates database accordingly (succeeded, failed, or retry_pending)
//
// This function is designed to be called by:
// - pg_cron scheduled job (every 6 hours)
// - Manual admin trigger for testing
//
// Security: Uses service role key to bypass RLS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

interface SyncTransferStatusResponse {
  success: boolean;
  batches_checked: number;
  transfers_updated: number;
  errors?: string[];
}

serve(async (req) => {
  console.log('=== sync-transfer-status Edge Function called ===');
  console.log('Method:', req.method);

  try {
    // Allow POST or GET requests (GET for manual triggers)
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
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Query all transfers with status 'processing' that have stripe_transfer_id
    const { data: processingTransfers, error: fetchError } = await supabase
      .from('detailer_transfers')
      .select(`
        id,
        booking_id,
        stripe_transfer_id,
        weekly_payout_batch_id,
        status
      `)
      .eq('status', 'processing')
      .not('stripe_transfer_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching processing transfers:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch processing transfers' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!processingTransfers || processingTransfers.length === 0) {
      console.log('No processing transfers found');
      return new Response(
        JSON.stringify({
          success: true,
          batches_checked: 0,
          transfers_updated: 0,
          message: 'No processing transfers to sync',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${processingTransfers.length} processing transfers to sync`);

    // Group transfers by weekly_payout_batch_id to minimize Stripe API calls
    const transfersByBatch: Record<string, typeof processingTransfers> = {};
    const individualTransfers: typeof processingTransfers = [];

    for (const transfer of processingTransfers) {
      if (transfer.weekly_payout_batch_id) {
        const batchId = transfer.weekly_payout_batch_id;
        if (!transfersByBatch[batchId]) {
          transfersByBatch[batchId] = [];
        }
        transfersByBatch[batchId].push(transfer);
      } else {
        individualTransfers.push(transfer);
      }
    }

    console.log(`Grouped into ${Object.keys(transfersByBatch).length} batches and ${individualTransfers.length} individual transfers`);

    const errors: string[] = [];
    let batchesChecked = 0;
    let transfersUpdated = 0;

    // Process batch transfers
    for (const [batchId, transfers] of Object.entries(transfersByBatch)) {
      try {
        // Get batch info to get the stripe_transfer_id
        const { data: batch, error: batchError } = await supabase
          .from('solo_weekly_payout_batches')
          .select('id, stripe_transfer_id, status')
          .eq('id', batchId)
          .single();

        if (batchError || !batch || !batch.stripe_transfer_id) {
          const errorMsg = `Batch ${batchId} not found or missing stripe_transfer_id`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Skip if batch is already succeeded
        if (batch.status === 'succeeded') {
          console.log(`Batch ${batchId} already succeeded, skipping`);
          continue;
        }

        console.log(`Checking Stripe transfer ${batch.stripe_transfer_id} for batch ${batchId}`);

        // Check Stripe API for transfer status
        let stripeTransfer;
        try {
          stripeTransfer = await stripe.transfers.retrieve(batch.stripe_transfer_id);
          
          // Log the full transfer object to understand its structure
          console.log(`Full Stripe transfer object keys:`, Object.keys(stripeTransfer));
          console.log(`Transfer details:`, {
            id: stripeTransfer.id,
            status: stripeTransfer.status,
            amount: stripeTransfer.amount,
            reversed: stripeTransfer.reversed,
            destination: stripeTransfer.destination,
            created: stripeTransfer.created,
            livemode: stripeTransfer.livemode,
            object: stripeTransfer.object,
            reversed_at: stripeTransfer.reversed_at,
            amount_reversed: stripeTransfer.amount_reversed
          });
        } catch (stripeError) {
          const errorMsg = `Failed to retrieve Stripe transfer ${batch.stripe_transfer_id}: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Determine transfer status
        // If status is undefined, check other indicators
        let transferStatus = stripeTransfer.status;
        
        if (transferStatus === undefined || transferStatus === null) {
          console.log(`⚠️  Transfer status is undefined. Checking other indicators...`);
          
          // If transfer exists, isn't reversed, and has an amount, it's likely paid
          // Completed transfers might not have a status field in some Stripe API versions
          if (stripeTransfer.reversed === false && stripeTransfer.amount > 0 && !stripeTransfer.reversed_at) {
            console.log(`✅ Transfer exists, not reversed, has amount. Treating as 'paid'.`);
            transferStatus = 'paid';
          } else if (stripeTransfer.reversed === true || stripeTransfer.reversed_at) {
            console.log(`❌ Transfer has been reversed. Treating as 'failed'.`);
            transferStatus = 'failed';
          } else {
            console.log(`⚠️  Cannot determine transfer status from available fields. Skipping.`);
            console.log(`Full transfer object:`, JSON.stringify(stripeTransfer, null, 2));
            continue;
          }
        }

        console.log(`Stripe transfer ${batch.stripe_transfer_id} determined status: ${transferStatus}`);

        batchesChecked++;

        // Update based on Stripe status
        if (transferStatus === 'paid') {
          // Update batch to succeeded
          const { error: updateBatchError } = await supabase
            .from('solo_weekly_payout_batches')
            .update({
              status: 'succeeded',
              updated_at: new Date().toISOString(),
            })
            .eq('id', batchId);

          if (updateBatchError) {
            const errorMsg = `Failed to update batch ${batchId}: ${updateBatchError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue;
          }

          // Update all related transfers to succeeded
          const transferIds = transfers.map(t => t.id);
          const { error: updateTransfersError, count } = await supabase
            .from('detailer_transfers')
            .update({
              status: 'succeeded',
              updated_at: new Date().toISOString(),
            })
            .in('id', transferIds)
            .eq('status', 'processing'); // Only update transfers that are still processing

          if (updateTransfersError) {
            const errorMsg = `Failed to update transfers for batch ${batchId}: ${updateTransfersError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          } else {
            transfersUpdated += count || transfers.length;
            console.log(`✅ Updated batch ${batchId} and ${count || transfers.length} transfers to 'succeeded'`);
          }
        } else if (transferStatus === 'failed' || transferStatus === 'canceled') {
          // Update batch to failed
          const errorMessage = stripeTransfer.failure_message || stripeTransfer.failure_code || 'Transfer failed';
          const { error: updateBatchError } = await supabase
            .from('solo_weekly_payout_batches')
            .update({
              status: 'failed',
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', batchId);

          if (updateBatchError) {
            const errorMsg = `Failed to update batch ${batchId}: ${updateBatchError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue;
          }

          // Update all related transfers to retry_pending
          const transferIds = transfers.map(t => t.id);
          const { error: updateTransfersError, count } = await supabase
            .from('detailer_transfers')
            .update({
              status: 'retry_pending',
              error_message: `Batch transfer failed: ${errorMessage}`,
              updated_at: new Date().toISOString(),
            })
            .in('id', transferIds)
            .eq('status', 'processing');

          if (updateTransfersError) {
            const errorMsg = `Failed to update transfers for batch ${batchId}: ${updateTransfersError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          } else {
            transfersUpdated += count || transfers.length;
            console.log(`⚠️  Updated batch ${batchId} to 'failed' and ${count || transfers.length} transfers to 'retry_pending'`);
          }
        } else {
          console.log(`ℹ️  Batch ${batchId} transfer status is '${transferStatus}', no update needed`);
        }
      } catch (error) {
        const errorMsg = `Error processing batch ${batchId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Process individual transfers (not in a batch)
    for (const transfer of individualTransfers) {
      try {
        if (!transfer.stripe_transfer_id) {
          continue;
        }

        console.log(`Checking individual Stripe transfer ${transfer.stripe_transfer_id} for transfer ${transfer.id}`);

        // Check Stripe API for transfer status
        let stripeTransfer;
        try {
          stripeTransfer = await stripe.transfers.retrieve(transfer.stripe_transfer_id);
          
          // Log for debugging
          console.log(`Individual transfer details:`, {
            id: stripeTransfer.id,
            status: stripeTransfer.status,
            reversed: stripeTransfer.reversed,
            amount: stripeTransfer.amount,
            reversed_at: stripeTransfer.reversed_at
          });
        } catch (stripeError) {
          const errorMsg = `Failed to retrieve Stripe transfer ${transfer.stripe_transfer_id}: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Determine transfer status (same logic as batch transfers)
        let transferStatus = stripeTransfer.status;
        
        if (transferStatus === undefined || transferStatus === null) {
          console.log(`⚠️  Individual transfer status is undefined. Checking other indicators...`);
          
          if (stripeTransfer.reversed === false && stripeTransfer.amount > 0 && !stripeTransfer.reversed_at) {
            console.log(`✅ Individual transfer exists, not reversed, has amount. Treating as 'paid'.`);
            transferStatus = 'paid';
          } else if (stripeTransfer.reversed === true || stripeTransfer.reversed_at) {
            console.log(`❌ Individual transfer has been reversed. Treating as 'failed'.`);
            transferStatus = 'failed';
          } else {
            console.log(`⚠️  Cannot determine individual transfer status, skipping.`);
            continue;
          }
        }

        console.log(`Stripe transfer ${transfer.stripe_transfer_id} determined status: ${transferStatus}`);

        // Update based on Stripe status
        if (transferStatus === 'paid') {
          const { error: updateError } = await supabase
            .from('detailer_transfers')
            .update({
              status: 'succeeded',
              updated_at: new Date().toISOString(),
            })
            .eq('id', transfer.id)
            .eq('status', 'processing'); // Only update if still processing

          if (updateError) {
            const errorMsg = `Failed to update transfer ${transfer.id}: ${updateError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          } else {
            transfersUpdated++;
            console.log(`✅ Updated individual transfer ${transfer.id} to 'succeeded'`);
          }
        } else if (transferStatus === 'failed' || transferStatus === 'canceled') {
          const errorMessage = stripeTransfer.failure_message || stripeTransfer.failure_code || 'Transfer failed';
          const { error: updateError } = await supabase
            .from('detailer_transfers')
            .update({
              status: 'retry_pending',
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', transfer.id)
            .eq('status', 'processing');

          if (updateError) {
            const errorMsg = `Failed to update transfer ${transfer.id}: ${updateError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          } else {
            transfersUpdated++;
            console.log(`⚠️  Updated individual transfer ${transfer.id} to 'retry_pending'`);
          }
        } else {
          console.log(`ℹ️  Transfer ${transfer.id} status is '${transferStatus}', no update needed`);
        }
      } catch (error) {
        const errorMsg = `Error processing individual transfer ${transfer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const response: SyncTransferStatusResponse = {
      success: true,
      batches_checked: batchesChecked,
      transfers_updated: transfersUpdated,
      ...(errors.length > 0 && { errors }),
    };

    console.log(`✅ Sync complete: ${batchesChecked} batches checked, ${transfersUpdated} transfers updated`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Unhandled error in sync-transfer-status:', error);
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

