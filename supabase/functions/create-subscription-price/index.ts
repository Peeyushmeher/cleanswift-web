// Supabase Edge Function: create-subscription-price
// Purpose: Create a new Stripe price for detailer subscriptions when admin updates the price
//
// Security features:
// - Only called by admin users (verified in server action)
// - Creates new Stripe Price object
// - Updates platform_settings with new price ID
// - Returns new price ID to admin

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const getCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': requestOrigin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
});

interface CreatePriceRequest {
  amount: number; // Price amount in dollars (e.g., 29.99)
}

interface CreatePriceResponse {
  success: boolean;
  price_id?: string;
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
    console.log('=== create-subscription-price Edge Function called ===');

    // Get Stripe secret key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured', success: false }),
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

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error', success: false }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
    let requestBody: CreatePriceRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected JSON with amount field.', success: false }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { amount } = requestBody;

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0 || amount > 999) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount. Must be a number between 0 and 999.', success: false }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get or create Stripe product for detailer subscriptions
    // Check if product ID exists in platform_settings
    let productId: string;
    const { data: productSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'subscription_product_id')
      .maybeSingle();

    if (productSetting && productSetting.value && typeof productSetting.value === 'string') {
      productId = productSetting.value;
      // Verify product still exists in Stripe
      try {
        await stripe.products.retrieve(productId);
        console.log('✅ Using existing Stripe product:', productId);
      } catch (error) {
        console.warn('Existing product not found in Stripe, creating new one');
        productId = '';
      }
    }

    // If no product exists, create one
    if (!productId) {
      const product = await stripe.products.create({
        name: 'Detailer Monthly Subscription',
        description: 'Monthly subscription for detailers on the platform',
        metadata: {
          type: 'detailer_subscription',
        },
      });
      productId = product.id;
      console.log('✅ Created new Stripe product:', productId);

      // Store product ID in platform_settings
      await supabase
        .from('platform_settings')
        .upsert({
          key: 'subscription_product_id',
          value: productId,
          description: 'Stripe Product ID for detailer subscriptions',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        });
    }

    // Create new Stripe price
    // Convert dollars to cents for Stripe (amount is in dollars)
    const amountCents = Math.round(amount * 100);
    
    console.log('Creating Stripe price for product:', productId, 'Amount:', amount, 'USD');
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: amountCents,
      currency: 'cad', // Assuming CAD based on the codebase
      recurring: {
        interval: 'month',
      },
      metadata: {
        type: 'detailer_monthly_subscription',
      },
    });

    console.log('✅ Created Stripe price:', price.id);

    // Update platform_settings with new price ID
    const { error: updateError } = await supabase
      .from('platform_settings')
      .update({
        value: price.id,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'subscription_price_id');

    if (updateError) {
      console.error('❌ Failed to update subscription_price_id in platform_settings:', updateError);
      // Don't fail the request - price was created successfully
    } else {
      console.log('✅ Updated subscription_price_id in platform_settings');
    }

    const response: CreatePriceResponse = {
      success: true,
      price_id: price.id,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Unhandled error in create-subscription-price:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

