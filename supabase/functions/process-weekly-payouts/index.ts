// @ts-nocheck
// TypeScript errors in this file are expected - this runs in Deno, not Node.js
// The code works correctly when deployed to Supabase Edge Functions

// Supabase Edge Function: process-weekly-payouts
// Purpose: Process weekly batch payouts for solo detailers
//
// This function:
// 1. Queries all pending transfers from the previous week (Monday-Sunday)
// 2. Groups transfers by detailer_id
// 3. Creates weekly batch records and Stripe transfers for each detailer
// 4. Updates all related transfers to link to their batch
//
// This function is designed to be called by:
// - pg_cron scheduled job (every Wednesday at 9 AM)
// - Manual admin trigger for testing
//
// Security: Uses service role key to bypass RLS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

interface ProcessWeeklyPayoutsResponse {
  success: boolean;
  batches_created: number;
  transfers_processed: number;
  total_amount_cents: number;
  errors?: string[];
}

// Helper function to get the previous week's Monday and Sunday dates
function getPreviousWeekDates(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days to subtract to get to last Monday
  // If today is Wednesday (3), we want last Monday (2 days ago)
  // If today is Sunday (0), we want the Monday from 6 days ago
  let daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  daysToLastMonday += 7; // Go back one full week
  
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  
  return { weekStart: lastMonday, weekEnd: lastSunday };
}

serve(async (req) => {
  console.log('=== process-weekly-payouts Edge Function called ===');

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

    // Get previous week dates (Monday to Sunday)
    const { weekStart, weekEnd } = getPreviousWeekDates();
    const weekStartStr = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    console.log(`Processing weekly payouts for week: ${weekStartStr} to ${weekEndStr}`);

    // Query all pending transfers from the previous week
    // Only include solo detailers (organization_id IS NULL)
    const { data: pendingTransfers, error: fetchError } = await supabase
      .from('detailer_transfers')
      .select(`
        id,
        booking_id,
        detailer_id,
        amount_cents,
        created_at,
        detailers!inner(
          id,
          stripe_connect_account_id,
          organization_id
        )
      `)
      .eq('status', 'pending')
      .is('weekly_payout_batch_id', null) // Not already in a batch
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())
      .is('detailers.organization_id', null); // Only solo detailers

    if (fetchError) {
      console.error('Error fetching pending transfers:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending transfers' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!pendingTransfers || pendingTransfers.length === 0) {
      console.log('No pending transfers for the previous week');
      return new Response(
        JSON.stringify({
          success: true,
          batches_created: 0,
          transfers_processed: 0,
          total_amount_cents: 0,
          message: 'No pending transfers for the previous week',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${pendingTransfers.length} pending transfers for the previous week`);

    // Group transfers by detailer_id
    const transfersByDetailer: Record<string, typeof pendingTransfers> = {};
    for (const transfer of pendingTransfers) {
      const detailerId = transfer.detailer_id;
      if (!transfersByDetailer[detailerId]) {
        transfersByDetailer[detailerId] = [];
      }
      transfersByDetailer[detailerId].push(transfer);
    }

    console.log(`Grouped into ${Object.keys(transfersByDetailer).length} detailers`);

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

    // Process each detailer's batch
    const errors: string[] = [];
    let batchesCreated = 0;
    let transfersProcessed = 0;
    let totalAmountCents = 0;

    for (const [detailerId, transfers] of Object.entries(transfersByDetailer)) {
      try {
        // Get detailer info (should have stripe_connect_account_id from the join)
        const firstTransfer = transfers[0];
        const detailerData = firstTransfer.detailers as any;
        // Handle both array and object formats from Supabase join
        const detailer = Array.isArray(detailerData) ? detailerData[0] : detailerData;
        
        if (!detailer || !detailer.stripe_connect_account_id) {
          const errorMsg = `Detailer ${detailerId} has no Stripe Connect account`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Calculate total amount for this detailer
        const totalAmount = transfers.reduce((sum, t) => sum + (t.amount_cents || 0), 0);
        totalAmountCents += totalAmount;

        if (totalAmount <= 0) {
          console.log(`Skipping detailer ${detailerId}: total amount is 0 or negative`);
          continue;
        }

        console.log(`Processing batch for detailer ${detailerId}: ${transfers.length} transfers, ${totalAmount} cents`);

        // Create weekly batch record
        const { data: batch, error: batchError } = await supabase
          .from('solo_weekly_payout_batches')
          .insert({
            detailer_id: detailerId,
            week_start_date: weekStartStr,
            week_end_date: weekEndStr,
            total_amount_cents: totalAmount,
            total_transfers: transfers.length,
            status: 'pending',
          })
          .select()
          .single();

        if (batchError || !batch) {
          const errorMsg = `Failed to create batch for detailer ${detailerId}: ${batchError?.message || 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        console.log(`Created batch ${batch.id} for detailer ${detailerId}`);

        // Create Stripe transfer
        try {
          const stripeTransfer = await stripe.transfers.create({
            amount: totalAmount,
            currency: 'cad',
            destination: detailer.stripe_connect_account_id,
            metadata: {
              weekly_batch_id: batch.id,
              detailer_id: detailerId,
              week_start: weekStartStr,
              week_end: weekEndStr,
              transfer_count: String(transfers.length),
            },
          });

          console.log(`✅ Created Stripe transfer ${stripeTransfer.id} for batch ${batch.id}`);

          // Update batch with Stripe transfer ID and status
          const { error: updateBatchError } = await supabase
            .from('solo_weekly_payout_batches')
            .update({
              stripe_transfer_id: stripeTransfer.id,
              status: 'processing',
              processed_at: new Date().toISOString(),
            })
            .eq('id', batch.id);

          if (updateBatchError) {
            console.error(`Failed to update batch ${batch.id}:`, updateBatchError);
            // Continue - the transfer was created successfully
          }

          // Update all related transfers to link to batch
          const transferIds = transfers.map(t => t.id);
          const { error: updateTransfersError } = await supabase
            .from('detailer_transfers')
            .update({
              weekly_payout_batch_id: batch.id,
              stripe_transfer_id: stripeTransfer.id,
              status: 'processing', // Will be updated to 'succeeded' via webhook
            })
            .in('id', transferIds);

          if (updateTransfersError) {
            const errorMsg = `Failed to update transfers for batch ${batch.id}: ${updateTransfersError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            // Continue - batch and Stripe transfer were created successfully
          } else {
            console.log(`✅ Updated ${transferIds.length} transfers to link to batch ${batch.id}`);
            batchesCreated++;
            transfersProcessed += transfers.length;
          }

        } catch (stripeError) {
          console.error(`Stripe transfer error for detailer ${detailerId}:`, stripeError);
          
          const errorMessage = stripeError instanceof Stripe.errors.StripeError
            ? stripeError.message
            : 'Unknown Stripe error';

          // Update batch to failed status
          await supabase
            .from('solo_weekly_payout_batches')
            .update({
              status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', batch.id);

          const errorMsg = `Stripe error for detailer ${detailerId}: ${errorMessage}`;
          errors.push(errorMsg);
        }

      } catch (error) {
        const errorMsg = `Error processing batch for detailer ${detailerId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const response: ProcessWeeklyPayoutsResponse = {
      success: true,
      batches_created: batchesCreated,
      transfers_processed: transfersProcessed,
      total_amount_cents: totalAmountCents,
      ...(errors.length > 0 && { errors }),
    };

    console.log(`✅ Weekly payout processing complete: ${batchesCreated} batches, ${transfersProcessed} transfers, ${totalAmountCents} cents`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Unhandled error in process-weekly-payouts:', error);
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

