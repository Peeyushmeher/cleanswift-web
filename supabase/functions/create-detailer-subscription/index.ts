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

// Get allowed origins from environment variable or use default
// Format: comma-separated list of origins (e.g., "https://app.example.com,https://www.example.com")
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOriginsEnv) {
    const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim());
    // If request origin is in allowed list, use it; otherwise use first allowed origin
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      return requestOrigin;
    }
    return allowedOrigins[0] || '*';
  }
  // Fallback: allow same origin or use wildcard (less secure but functional)
  return requestOrigin || '*';
};

const getCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
});

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
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(requestOrigin);
  
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

    // Log key type for debugging (first few characters only)
    const keyPrefix = stripeKey.substring(0, 7);
    const keyType = keyPrefix === 'sk_test' ? 'TEST' : keyPrefix === 'sk_live' ? 'LIVE' : 'UNKNOWN';
    console.log('🔑 Edge Function using Stripe key type:', keyType);

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-12-15.clover',
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

    // Note: We allow creating subscription even if pricing_model isn't set to 'subscription' yet
    // The API route will update pricing_model before calling this function, but there may be
    // timing issues. If pricing_model is not 'subscription', we'll update it here as well.
    if (detailer.pricing_model !== 'subscription') {
      console.log('ℹ️  Updating pricing_model to subscription for detailer:', detailer.pricing_model);
      await supabase
        .from('detailers')
        .update({ pricing_model: 'subscription' })
        .eq('id', detailer_id);
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

    // Get subscription price ID from database (with env var fallback)
    // First try to get from platform_settings
    const { data: priceSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'subscription_price_id')
      .maybeSingle();
    
    let subscriptionPriceId: string | null = null;
    
    if (priceSetting && priceSetting.value && typeof priceSetting.value === 'string' && priceSetting.value !== 'null') {
      subscriptionPriceId = priceSetting.value;
      console.log('✅ Using subscription price ID from database:', subscriptionPriceId);
    } else {
      // Fallback to environment variable
      subscriptionPriceId = Deno.env.get('STRIPE_SUBSCRIPTION_PRICE_ID') || null;
      if (subscriptionPriceId) {
        console.log('✅ Using subscription price ID from environment variable');
      }
    }
    
    if (!subscriptionPriceId) {
      console.error('❌ Subscription price ID not found in database or environment');
      return new Response(
        JSON.stringify({ 
          error: 'Subscription price ID not configured. Please configure subscription price in admin settings or set STRIPE_SUBSCRIPTION_PRICE_ID environment variable.',
          success: false 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Creating Stripe subscription for customer:', stripeCustomerId);
    console.log('Using price ID:', subscriptionPriceId);
    console.log('Stripe key type:', keyType);
    
    // Verify the price exists before creating subscription
    try {
      const price = await stripe.prices.retrieve(subscriptionPriceId);
      console.log('✅ Verified price exists:', price.id, 'Amount:', price.unit_amount, price.currency);
    } catch (priceError: any) {
      console.error('❌ Price verification failed:', priceError.message);
      if (priceError.code === 'resource_missing') {
        console.error('❌ CRITICAL: Price ID does not exist in Stripe!');
        console.error('❌ Price ID:', subscriptionPriceId);
        console.error('❌ This price ID needs to be created in Stripe or updated in platform_settings');
        return new Response(
          JSON.stringify({ 
            error: `Subscription price ID '${subscriptionPriceId}' does not exist in Stripe. Please create the price in Stripe Dashboard or update the price ID in admin settings.`,
            success: false,
            price_id: subscriptionPriceId
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      throw priceError;
    }
    
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
    console.log('✅ Subscription status:', subscription.status);
    console.log('✅ Subscription created in Stripe account type:', keyType);

    // Verify the subscription actually exists by retrieving it
    try {
      const verifySubscription = await stripe.subscriptions.retrieve(subscription.id);
      console.log('✅ Verified subscription exists in Stripe:', verifySubscription.id);
    } catch (verifyError: any) {
      console.error('❌ CRITICAL: Subscription was created but cannot be retrieved!');
      console.error('❌ Verification error:', verifyError.message);
      console.error('❌ This suggests a Stripe key mismatch or account issue');
      return new Response(
        JSON.stringify({ 
          error: 'Subscription created but verification failed. Please check Stripe key configuration.',
          subscription_id: subscription.id,
          success: false 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
    } else {
      console.log('✅ Updated detailer record with subscription ID:', subscription.id);
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

