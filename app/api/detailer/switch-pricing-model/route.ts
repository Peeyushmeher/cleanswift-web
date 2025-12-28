import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getSubscriptionPriceId } from '@/lib/platform-settings';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get detailer record
    const { data: detailer, error: detailerError } = await supabase
      .from('detailers')
      .select('id, pricing_model, stripe_subscription_id, stripe_customer_id')
      .eq('profile_id', user.id)
      .single();

    if (detailerError || !detailer) {
      return NextResponse.json({ error: 'Detailer not found' }, { status: 404 });
    }

    const { pricing_model } = await request.json();

    if (!pricing_model || !['subscription', 'percentage'].includes(pricing_model)) {
      return NextResponse.json({ error: 'Invalid pricing model' }, { status: 400 });
    }

    // If already on this model, return success
    if (detailer.pricing_model === pricing_model) {
      return NextResponse.json({ success: true, message: 'Already on this pricing model' });
    }

    // If switching FROM subscription, cancel it via webhook (will be handled when subscription is cancelled in Stripe)
    // For now, we'll just update the database and let Stripe webhooks handle the cancellation
    if (detailer.pricing_model === 'subscription' && detailer.stripe_subscription_id) {
      // Note: In production, you'd want to call Stripe API to cancel the subscription
      // For now, we'll update the database and the webhook will handle cleanup
      console.log('Subscription will be cancelled via Stripe dashboard or webhook:', detailer.stripe_subscription_id);
    }

    // If switching TO subscription, create it via Edge Function
    if (pricing_model === 'subscription') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 500 });
      }

      // First, update pricing model so Edge Function can validate it
      // Use service client to bypass RLS (we've already verified user owns this detailer)
      const serviceClient = createServiceClient();
      const { error: updateError } = await serviceClient
        .from('detailers')
        .update({
          pricing_model: pricing_model,
          updated_at: new Date().toISOString(),
        })
        .eq('id', detailer.id)
        .eq('profile_id', user.id); // Extra safety check

      if (updateError) {
        console.error('Error updating detailer:', updateError);
        return NextResponse.json({ error: 'Failed to update pricing model' }, { status: 500 });
      }

      try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
          console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
          // Revert pricing model
          await supabase
            .from('detailers')
            .update({
              pricing_model: detailer.pricing_model,
              updated_at: new Date().toISOString(),
            })
            .eq('id', detailer.id);
          
          return NextResponse.json({ 
            error: 'Server configuration error. Please contact support.',
            code: 'MISSING_SERVICE_ROLE_KEY'
          }, { status: 500 });
        }

        const functionUrl = `${supabaseUrl}/functions/v1/create-detailer-subscription`;
        console.log('Calling subscription creation Edge Function:', functionUrl);
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ detailer_id: detailer.id }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
          console.error('Subscription creation failed:', errorData);
          
          // If subscription creation fails, revert pricing model
          await serviceClient
            .from('detailers')
            .update({
              pricing_model: detailer.pricing_model, // Revert to previous model
              updated_at: new Date().toISOString(),
            })
            .eq('id', detailer.id)
            .eq('profile_id', user.id);
          
          return NextResponse.json({ 
            error: errorData.error || 'Failed to create subscription',
            details: errorData.details || errorData.message,
            code: errorData.code || 'SUBSCRIPTION_CREATE_FAILED'
          }, { status: response.status || 500 });
        }

        const result = await response.json();
        console.log('Subscription created successfully:', result.stripe_subscription_id);

        // Return success with flag indicating payment is needed
        return NextResponse.json({ 
          success: true, 
          message: 'Subscription created successfully. Please complete payment setup.',
          requiresPayment: true,
          subscriptionId: result.stripe_subscription_id,
          paymentUrl: '/detailer/subscription/payment'
        });
      } catch (error: any) {
        console.error('Error creating subscription:', error);
        console.error('Error type:', error?.constructor?.name);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        
        // Revert pricing model on error
        const serviceClientForRevert = createServiceClient();
        await serviceClientForRevert
          .from('detailers')
          .update({
            pricing_model: detailer.pricing_model, // Revert to previous model
            updated_at: new Date().toISOString(),
          })
          .eq('id', detailer.id)
          .eq('profile_id', user.id);
        
        return NextResponse.json({ 
          error: 'Failed to create subscription. Please try again or contact support.',
          details: error?.message || 'Network or server error occurred',
          code: 'SUBSCRIPTION_CREATE_ERROR'
        }, { status: 500 });
      }
    } else {
      // Switching to percentage model - just update database
      console.log('Switching to percentage model for detailer:', detailer.id);
      console.log('Current pricing_model:', detailer.pricing_model);
      console.log('New pricing_model:', pricing_model);
      
      // Use service client to bypass RLS (since detailers can't directly update their own record via RLS)
      // We've already verified the user owns this detailer record via the initial query
      const serviceClient = createServiceClient();
      const { data: updatedDetailer, error: updateError } = await serviceClient
        .from('detailers')
        .update({
          pricing_model: pricing_model,
          stripe_subscription_id: null, // Clear subscription ID (webhook will handle Stripe side)
          updated_at: new Date().toISOString(),
        })
        .eq('id', detailer.id)
        .eq('profile_id', user.id) // Extra safety check: ensure user owns this detailer
        .select('id, pricing_model, stripe_subscription_id')
        .single();

      if (updateError) {
        console.error('Error updating detailer:', updateError);
        console.error('Update error details:', JSON.stringify(updateError, null, 2));
        return NextResponse.json({ 
          error: 'Failed to update pricing model',
          details: updateError.message,
          code: 'UPDATE_FAILED'
        }, { status: 500 });
      }

      if (!updatedDetailer) {
        console.error('Update succeeded but no data returned');
        return NextResponse.json({ 
          error: 'Update completed but could not verify',
          code: 'UPDATE_VERIFICATION_FAILED'
        }, { status: 500 });
      }

      console.log('Successfully updated detailer:', {
        id: updatedDetailer.id,
        pricing_model: updatedDetailer.pricing_model,
        stripe_subscription_id: updatedDetailer.stripe_subscription_id
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Pricing model updated to Pay Per Booking',
        pricing_model: updatedDetailer.pricing_model
      });
    }
  } catch (error) {
    console.error('Error switching pricing model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

