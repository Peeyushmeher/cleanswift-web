import { createClient } from '@/lib/supabase/server';
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
      const { error: updateError } = await supabase
        .from('detailers')
        .update({
          pricing_model: pricing_model,
          updated_at: new Date().toISOString(),
        })
        .eq('id', detailer.id);

      if (updateError) {
        console.error('Error updating detailer:', updateError);
        return NextResponse.json({ error: 'Failed to update pricing model' }, { status: 500 });
      }

      try {
        const functionUrl = `${supabaseUrl}/functions/v1/create-detailer-subscription`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ detailer_id: detailer.id }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // If subscription creation fails, revert pricing model
          await supabase
            .from('detailers')
            .update({
              pricing_model: detailer.pricing_model, // Revert to previous model
              updated_at: new Date().toISOString(),
            })
            .eq('id', detailer.id);
          
          return NextResponse.json({ 
            error: errorData.error || 'Failed to create subscription' 
          }, { status: 500 });
        }

        const result = await response.json();

        return NextResponse.json({ 
          success: true, 
          message: 'Pricing model updated. Please complete subscription setup in Stripe.' 
        });
      } catch (error) {
        console.error('Error creating subscription:', error);
        // Revert pricing model on error
        await supabase
          .from('detailers')
          .update({
            pricing_model: detailer.pricing_model, // Revert to previous model
            updated_at: new Date().toISOString(),
          })
          .eq('id', detailer.id);
        
        return NextResponse.json({ 
          error: 'Failed to create subscription' 
        }, { status: 500 });
      }
    } else {
      // Switching to percentage model - just update database
      const { error: updateError } = await supabase
        .from('detailers')
        .update({
          pricing_model: pricing_model,
          stripe_subscription_id: null, // Clear subscription ID (webhook will handle Stripe side)
          updated_at: new Date().toISOString(),
        })
        .eq('id', detailer.id);

      if (updateError) {
        console.error('Error updating detailer:', updateError);
        return NextResponse.json({ error: 'Failed to update pricing model' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Pricing model updated to Pay Per Booking' 
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

