// Supabase Edge Function: create-stripe-connect-account
// Purpose: Create Stripe Connect account and return OAuth link for detailers
//
// Security features:
// - Validates detailer exists and is authenticated
// - Creates Stripe Connect account if doesn't exist
// - Returns account link for OAuth onboarding
// - Handles both solo detailers and organizations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

// Get allowed origins from environment variable or use default
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOriginsEnv) {
    const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim());
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      return requestOrigin;
    }
    return allowedOrigins[0] || '*';
  }
  return requestOrigin || '*';
};

const getCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
});

interface ConnectAccountRequest {
  detailer_id?: string;
  organization_id?: string;
  return_url?: string;
  refresh_url?: string;
}

interface ConnectAccountResponse {
  success: boolean;
  account_id?: string;
  account_link_url?: string;
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
    console.log('=== create-stripe-connect-account Edge Function called ===');
    console.log('Method:', req.method);

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let requestBody: ConnectAccountRequest;
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

    const { detailer_id, organization_id, return_url, refresh_url } = requestBody;

    // Validate that either detailer_id or organization_id is provided
    if (!detailer_id && !organization_id) {
      return new Response(
        JSON.stringify({ error: 'Either detailer_id or organization_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
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

    // Use service role client for database operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let accountId: string | null = null;
    let accountType: 'detailer' | 'organization' = 'detailer';

    // Handle organization Connect account
    if (organization_id) {
      // Verify user is owner/manager of organization
      const { data: orgMember, error: orgError } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('organization_id', organization_id)
        .eq('profile_id', user.id)
        .single();

      if (orgError || !orgMember || (orgMember.role !== 'owner' && orgMember.role !== 'manager')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Must be organization owner or manager.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get organization
      const { data: org, error: orgFetchError } = await supabase
        .from('organizations')
        .select('id, stripe_connect_account_id')
        .eq('id', organization_id)
        .single();

      if (orgFetchError || !org) {
        return new Response(
          JSON.stringify({ error: 'Organization not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      accountId = org.stripe_connect_account_id;
      accountType = 'organization';
    } else if (detailer_id) {
      // Handle solo detailer Connect account
      // Verify user owns this detailer
      const { data: detailer, error: detailerError } = await supabase
        .from('detailers')
        .select('id, profile_id, stripe_connect_account_id')
        .eq('id', detailer_id)
        .single();

      if (detailerError || !detailer) {
        return new Response(
          JSON.stringify({ error: 'Detailer not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (detailer.profile_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. This detailer does not belong to you.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      accountId = detailer.stripe_connect_account_id;
    }

    // Get return URLs from request or use defaults
    const baseUrl = return_url || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://app.cleanswift.com';
    const finalReturnUrl = `${baseUrl}/detailer/settings?connected=true`;
    const finalRefreshUrl = `${baseUrl}/detailer/settings?refresh=true`;

    // Create or retrieve Stripe Connect account
    let connectAccount;
    if (accountId) {
      // Account already exists, retrieve it
      console.log('Retrieving existing Stripe Connect account:', accountId);
      try {
        connectAccount = await stripe.accounts.retrieve(accountId);
        console.log('✅ Retrieved existing account:', connectAccount.id);
      } catch (retrieveError) {
        console.error('Failed to retrieve account, creating new one:', retrieveError);
        accountId = null; // Will create new account below
      }
    }

    if (!connectAccount) {
      // Create new Stripe Connect account
      console.log('Creating new Stripe Connect account');
      
      // Get detailer/organization info for account metadata
      let accountEmail: string | undefined;
      let accountName: string | undefined;

      if (accountType === 'organization' && organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', organization_id)
          .single();
        accountName = org?.name;
      } else if (detailer_id) {
        const { data: detailer } = await supabase
          .from('detailers')
          .select('full_name, profile:profiles!detailers_profile_id_fkey(email)')
          .eq('id', detailer_id)
          .single();
        accountName = detailer?.full_name;
        const profile = Array.isArray(detailer?.profile) ? detailer.profile[0] : detailer?.profile;
        accountEmail = profile?.email;
      }

      connectAccount = await stripe.accounts.create({
        type: 'express', // Express accounts for faster onboarding
        country: 'CA', // Canada
        email: accountEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          account_type: accountType,
          ...(organization_id ? { organization_id } : {}),
          ...(detailer_id ? { detailer_id } : {}),
          profile_id: user.id,
        },
        business_profile: {
          name: accountName,
        },
      });

      console.log('✅ Created Stripe Connect account:', connectAccount.id);

      // Save account ID to database
      if (accountType === 'organization' && organization_id) {
        await supabase
          .from('organizations')
          .update({ stripe_connect_account_id: connectAccount.id })
          .eq('id', organization_id);
      } else if (detailer_id) {
        await supabase
          .from('detailers')
          .update({ stripe_connect_account_id: connectAccount.id })
          .eq('id', detailer_id);
      }
    }

    // Create account link for onboarding
    console.log('Creating account link for onboarding');
    const accountLink = await stripe.accountLinks.create({
      account: connectAccount.id,
      refresh_url: finalRefreshUrl,
      return_url: finalReturnUrl,
      type: 'account_onboarding',
    });

    console.log('✅ Created account link:', accountLink.url);

    const response: ConnectAccountResponse = {
      success: true,
      account_id: connectAccount.id,
      account_link_url: accountLink.url,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Unhandled error in create-stripe-connect-account:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));

    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Stripe error: ${error.message}`,
          code: error.type,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

