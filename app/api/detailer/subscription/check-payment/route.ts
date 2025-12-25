import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
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

    // If not on subscription model, no payment needed
    if (detailer.pricing_model !== 'subscription') {
      return NextResponse.json({ 
        needsPayment: false,
        reason: 'not_subscription_model'
      });
    }

    // If no subscription ID, payment is needed (subscription should have been created on approval)
    if (!detailer.stripe_subscription_id) {
      return NextResponse.json({ 
        needsPayment: true,
        reason: 'no_subscription'
      });
    }

    // Check subscription status with Stripe
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-12-15.clover',
    });

    try {
      // Retrieve subscription with latest invoice and payment intent
      const subscription = await stripe.subscriptions.retrieve(
        detailer.stripe_subscription_id,
        {
          expand: ['latest_invoice.payment_intent'],
        }
      );

      // Check subscription status
      const statusesRequiringPayment = ['incomplete', 'incomplete_expired', 'past_due', 'unpaid'];
      
      if (statusesRequiringPayment.includes(subscription.status)) {
        return NextResponse.json({ 
          needsPayment: true,
          reason: 'subscription_status',
          subscriptionStatus: subscription.status
        });
      }

      // Check latest invoice payment intent status
      const latestInvoice = subscription.latest_invoice;
      if (latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
        const paymentIntent = (latestInvoice as any).payment_intent;
        
        if (paymentIntent && typeof paymentIntent === 'object' && 'status' in paymentIntent) {
          const paymentIntentStatus = paymentIntent.status as string;
          const statusesRequiringAction = ['requires_payment_method', 'requires_action', 'requires_confirmation'];
          
          if (statusesRequiringAction.includes(paymentIntentStatus)) {
            return NextResponse.json({ 
              needsPayment: true,
              reason: 'payment_intent_status',
              paymentIntentStatus: paymentIntentStatus
            });
          }
        }
      }

      // Subscription is active and payment is complete
      return NextResponse.json({ 
        needsPayment: false,
        reason: 'payment_complete',
        subscriptionStatus: subscription.status
      });

    } catch (stripeError: any) {
      console.error('Error retrieving subscription from Stripe:', stripeError);
      
      // If subscription doesn't exist in Stripe, clear the invalid ID and indicate payment is needed
      if (stripeError.code === 'resource_missing') {
        console.log('Subscription not found in Stripe, clearing invalid subscription ID from database');
        
        // Clear the invalid subscription ID so admin can re-create it
        await supabase
          .from('detailers')
          .update({ 
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', detailer.id);
        
        return NextResponse.json({ 
          needsPayment: true,
          reason: 'subscription_not_found',
          message: 'Subscription was not properly set up. Please contact support.'
        });
      }
      
      return NextResponse.json({ 
        error: 'Failed to check subscription status',
        details: stripeError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error checking subscription payment status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

