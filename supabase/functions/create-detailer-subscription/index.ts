// Supabase Edge Function: create-detailer-subscription
// Purpose: Create Stripe subscription for detailers on subscription pricing model
//
// Security features:
// - Validates detailer exists and has pricing_model = 'subscription'
// - Creates Stripe customer if doesn't exist
// - Creates subscription with $29.99/month price
// - Stores subscription IDs in detailers table
// - Handles idempotency (reuses existing subscription if present)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubscriptionRequest {
  detailer_id: string;
}

interface SubscriptionResponse {
  success: boolean;
  detailer_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== create-detailer-subscription Edge Function called ===');
    console.log('Method:', req.method);

    // Get Stripe secret key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
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

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
    let requestBody: SubscriptionRequest;
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

    const { detailer_id } = requestBody;

    // Validate required fields
    if (!detailer_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: detailer_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch detailer and profile
    const { data: detailer, error: detailerError } = await supabase
      .from('detailers')
      .select(`
        id,
        full_name,
        pricing_model,
        stripe_customer_id,
        stripe_subscription_id,
        profile_id,
        profile:profiles!detailers_profile_id_fkey(id, email, full_name)
      `)
      .eq('id', detailer_id)
      .single();

    if (detailerError || !detailer) {
      console.error('❌ Detailer not found:', detailerError);
      return new Response(
        JSON.stringify({ error: 'Detailer not found', success: false }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if detailer is on subscription model
    if (detailer.pricing_model !== 'subscription') {
      console.log('ℹ️  Detailer is not on subscription model:', detailer.pricing_model);
      return new Response(
        JSON.stringify({ 
          error: 'Detailer is not on subscription pricing model',
          success: false 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if subscription already exists
    if (detailer.stripe_subscription_id) {
      console.log('ℹ️  Subscription already exists:', detailer.stripe_subscription_id);
      return new Response(
        JSON.stringify({
          success: true,
          detailer_id: detailer.id,
          stripe_customer_id: detailer.stripe_customer_id || undefined,
          stripe_subscription_id: detailer.stripe_subscription_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId = detailer.stripe_customer_id;
    const profile = Array.isArray(detailer.profile) ? detailer.profile[0] : detailer.profile;

    if (!stripeCustomerId) {
      // Create Stripe customer
      const customerEmail = profile?.email || undefined;
      const customerName = detailer.full_name || profile?.full_name || undefined;

      console.log('Creating Stripe customer for detailer:', detailer_id);
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: {
          detailer_id: detailer.id,
          type: 'detailer_subscription',
        },
      });

      stripeCustomerId = customer.id;
      console.log('✅ Created Stripe customer:', stripeCustomerId);

      // Update detailer with customer ID
      await supabase
        .from('detailers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', detailer_id);
    } else {
      console.log('Using existing Stripe customer:', stripeCustomerId);
    }

    // Create subscription
    // Note: You'll need to create a product and price in Stripe Dashboard first
    // For now, we'll use a placeholder price ID - this should be configured as an env var
    const subscriptionPriceId = Deno.env.get('STRIPE_SUBSCRIPTION_PRICE_ID');
    
    if (!subscriptionPriceId) {
      console.error('❌ STRIPE_SUBSCRIPTION_PRICE_ID not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Subscription price ID not configured. Please set STRIPE_SUBSCRIPTION_PRICE_ID environment variable.',
          success: false 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Creating Stripe subscription for customer:', stripeCustomerId);
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: subscriptionPriceId }],
      metadata: {
        detailer_id: detailer.id,
        type: 'detailer_monthly_subscription',
      },
      payment_behavior: 'default_incomplete', // Requires payment method setup
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    console.log('✅ Created Stripe subscription:', subscription.id);

    // Update detailer with subscription ID
    const { error: updateError } = await supabase
      .from('detailers')
      .update({ 
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
      })
      .eq('id', detailer_id);

    if (updateError) {
      console.error('❌ Failed to update detailer with subscription ID:', updateError);
      // Don't fail - subscription was created successfully
    }

    const response: SubscriptionResponse = {
      success: true,
      detailer_id: detailer.id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Unhandled error in create-detailer-subscription:', error);
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

