// Supabase Edge Function: process-pending-transfers
// Purpose: Process pending detailer transfers by calling process-detailer-transfer for each
//
// This function is designed to be called by:
// - pg_cron scheduled job (every 5 minutes)
// - Manual admin trigger
// - Webhook or other automated systems
//
// Security: Uses service role key to bypass RLS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ProcessPendingTransfersResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

serve(async (req) => {
  console.log('=== process-pending-transfers Edge Function called ===');

  try {
    // Only allow POST requests (or GET for manual triggers)
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

    // Get pending transfers (limit to 50 at a time to avoid timeout)
    const { data: pendingTransfers, error: fetchError } = await supabase
      .from('detailer_transfers')
      .select('id, booking_id, detailer_id, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

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
      console.log('No pending transfers to process');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          failed: 0,
          message: 'No pending transfers',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${pendingTransfers.length} pending transfers to process`);

    // Process each transfer by calling the process-detailer-transfer function
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    // Get the Edge Function URL
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/process-detailer-transfer`;

    for (const transfer of pendingTransfers) {
      try {
        console.log(`Processing transfer ${transfer.id} for booking ${transfer.booking_id}`);

        // Call the process-detailer-transfer function
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          },
          body: JSON.stringify({
            booking_id: transfer.booking_id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMsg = `Transfer ${transfer.id}: ${errorData.error || 'Failed to process'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          failed++;
        } else {
          const result = await response.json();
          if (result.success) {
            console.log(`✅ Successfully processed transfer ${transfer.id}`);
            processed++;
          } else {
            console.log(`⚠️ Transfer ${transfer.id} returned success=false: ${result.error}`);
            // Still count as processed (it was handled, just not successfully)
            processed++;
            if (result.error) {
              errors.push(`Transfer ${transfer.id}: ${result.error}`);
            }
          }
        }
      } catch (error) {
        const errorMsg = `Transfer ${transfer.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`Error processing transfer ${transfer.id}:`, error);
        errors.push(errorMsg);
        failed++;
      }
    }

    const response: ProcessPendingTransfersResponse = {
      success: true,
      processed,
      failed,
      ...(errors.length > 0 && { errors }),
    };

    console.log(`✅ Processed ${processed} transfers, ${failed} failed`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Unhandled error in process-pending-transfers:', error);
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

