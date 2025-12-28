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

    // Verify subscription model
    if (detailer.pricing_model !== 'subscription') {
      return NextResponse.json({ error: 'Detailer is not on subscription model' }, { status: 400 });
    }

    if (!detailer.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Get Stripe secret key
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured in Next.js environment');
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    // Log key type for debugging (first few characters only)
    const keyPrefix = stripeKey.substring(0, 7);
    console.log('Using Stripe key type:', keyPrefix === 'sk_test' ? 'TEST' : keyPrefix === 'sk_live' ? 'LIVE' : 'UNKNOWN');

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-12-15.clover',
    });

    try {
      console.log('Attempting to retrieve subscription:', detailer.stripe_subscription_id);
      console.log('Using Stripe key type:', keyPrefix === 'sk_test' ? 'TEST' : keyPrefix === 'sk_live' ? 'LIVE' : 'UNKNOWN');
      
      // Retrieve subscription with latest invoice and payment intent
      const subscription = await stripe.subscriptions.retrieve(
        detailer.stripe_subscription_id,
        {
          expand: ['latest_invoice.payment_intent'],
        }
      );
      
      console.log('✅ Successfully retrieved subscription:', subscription.id);
      console.log('✅ Subscription status:', subscription.status);

      console.log('Subscription status:', subscription.status);
      console.log('Latest invoice type:', typeof subscription.latest_invoice);
      console.log('Latest invoice value:', subscription.latest_invoice);

      // Get latest invoice
      let latestInvoice = subscription.latest_invoice;
      
      // If latest_invoice is a string ID, retrieve it
      if (typeof latestInvoice === 'string') {
        console.log('Retrieving invoice by ID:', latestInvoice);
        latestInvoice = await stripe.invoices.retrieve(latestInvoice, {
          expand: ['payment_intent'],
        });
        console.log('Retrieved invoice status:', latestInvoice.status);
      }

      if (!latestInvoice) {
        console.error('No latest invoice found for subscription');
        // If no invoice exists, we might need to create one
        // For incomplete subscriptions, try to finalize or create invoice
        if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
          console.log('Subscription is incomplete, invoice may not be ready yet');
          return NextResponse.json({ 
            error: 'Subscription invoice not ready. Please try again in a moment.',
            code: 'INVOICE_NOT_READY'
          }, { status: 400 });
        }
        return NextResponse.json({ error: 'No invoice found for subscription' }, { status: 404 });
      }

      console.log('Invoice status:', latestInvoice.status);
      
      // Get payment intent from invoice
      // payment_intent can be a string ID or an expanded PaymentIntent object
      let paymentIntent: string | Stripe.PaymentIntent | null = null;
      if (typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
        paymentIntent = (latestInvoice as any).payment_intent;
        console.log('Invoice payment intent:', paymentIntent);
      }
      console.log('Payment intent from invoice:', paymentIntent ? (typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id) : 'null');
      
      // If payment intent is a string ID, retrieve it
      if (typeof paymentIntent === 'string') {
        console.log('Retrieving payment intent by ID:', paymentIntent);
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent);
        console.log('Retrieved payment intent status:', paymentIntent.status);
        console.log('Retrieved payment intent has client_secret:', !!paymentIntent.client_secret);
      }

      if (!paymentIntent) {
        // If no payment intent exists, create one directly for the invoice
        // This happens when invoice is finalized but has no payment method attached
        console.log('No payment intent found, creating one directly for invoice');
        console.log('Invoice status:', latestInvoice.status);
        console.log('Invoice amount due:', latestInvoice.amount_due);
        console.log('Invoice currency:', latestInvoice.currency);
        
        // Only create payment intent if invoice is 'open' and has amount due
        if (latestInvoice.status === 'open' && latestInvoice.amount_due > 0) {
          try {
            const invoiceAmount = latestInvoice.amount_due;
            const invoiceCurrency = latestInvoice.currency || 'cad';
            const customerId = typeof latestInvoice.customer === 'string' 
              ? latestInvoice.customer 
              : latestInvoice.customer?.id;
            
            if (!customerId) {
              console.error('No customer ID found on invoice');
              return NextResponse.json({ 
                error: 'Invoice does not have a customer associated. Please contact support.',
                code: 'NO_CUSTOMER_ON_INVOICE'
              }, { status: 400 });
            }
            
            console.log('Creating PaymentIntent for invoice:', {
              invoiceId: latestInvoice.id,
              amount: invoiceAmount,
              currency: invoiceCurrency,
              customerId: customerId
            });
            
            // Create a PaymentIntent for the invoice amount
            paymentIntent = await stripe.paymentIntents.create({
              amount: invoiceAmount,
              currency: invoiceCurrency,
              customer: customerId,
              automatic_payment_methods: {
                enabled: true,
              },
              metadata: {
                invoice_id: latestInvoice.id,
                subscription_id: subscription.id,
                detailer_id: detailer.id,
                type: 'subscription_setup',
              },
              description: `Subscription payment for invoice ${latestInvoice.number || latestInvoice.id}`,
            });
            
            console.log('✅ Created PaymentIntent:', paymentIntent.id);
            console.log('PaymentIntent status:', paymentIntent.status);
            console.log('PaymentIntent has client_secret:', !!paymentIntent.client_secret);
            
          } catch (createError: any) {
            console.error('Error creating payment intent:', createError);
            console.error('Create error code:', createError.code);
            console.error('Create error message:', createError.message);
            return NextResponse.json({ 
              error: 'Failed to create payment intent. Please contact support.',
              details: createError.message,
              code: 'PAYMENT_INTENT_CREATE_FAILED'
            }, { status: 500 });
          }
        } else if (latestInvoice.status === 'open' && latestInvoice.amount_due === 0) {
          // Invoice has no amount due - subscription might be free or already paid
          console.log('Invoice is open but has no amount due');
          return NextResponse.json({ 
            error: 'Invoice has no amount due. Your subscription may already be active.',
            code: 'NO_AMOUNT_DUE',
            subscriptionStatus: subscription.status
          }, { status: 400 });
        } else {
          console.error('Invoice is not in a state that allows payment intent creation. Status:', latestInvoice.status);
          return NextResponse.json({ 
            error: 'Cannot create payment intent for invoice. Please contact support.',
            code: 'INVOICE_STATE_INVALID',
            details: `Invoice status: ${latestInvoice.status}, Subscription status: ${subscription.status}`
          }, { status: 400 });
        }
        
        if (!paymentIntent) {
          console.error('Failed to create payment intent for invoice');
          return NextResponse.json({ 
            error: 'No payment intent found or could not be created. Please contact support.',
            code: 'NO_PAYMENT_INTENT',
            details: `Invoice status: ${latestInvoice.status}, Subscription status: ${subscription.status}`
          }, { status: 404 });
        }
      }

      // Get client secret from payment intent
      let clientSecret: string | null = null;
      let paymentIntentId: string;

      if (typeof paymentIntent === 'object' && 'client_secret' in paymentIntent) {
        paymentIntentId = paymentIntent.id;
        clientSecret = paymentIntent.client_secret;
      } else {
        return NextResponse.json({ 
          error: 'Invalid payment intent format',
          code: 'INVALID_PAYMENT_INTENT'
        }, { status: 500 });
      }

      if (!clientSecret) {
        return NextResponse.json({ 
          error: 'Payment intent does not have client secret. Please contact support.',
          code: 'NO_CLIENT_SECRET'
        }, { status: 500 });
      }

      // Get subscription amount from the invoice
      const amount = latestInvoice.amount_due || latestInvoice.total || 0;
      const currency = latestInvoice.currency || 'cad';

      return NextResponse.json({
        clientSecret,
        paymentIntentId,
        amount,
        currency,
        subscriptionId: subscription.id,
      });

    } catch (stripeError: any) {
      console.error('Error retrieving payment intent from Stripe:', stripeError);
      console.error('Stripe error type:', stripeError.type);
      console.error('Stripe error code:', stripeError.code);
      console.error('Stripe error message:', stripeError.message);
      
      // If subscription doesn't exist in Stripe, clear the invalid ID from database
      if (stripeError.code === 'resource_missing') {
        console.log('⚠️ Subscription not found in Stripe');
        console.log('Subscription ID that was not found:', detailer.stripe_subscription_id);
        console.log('Stripe key type being used:', stripeKey.substring(0, 7));
        console.log('⚠️ IMPORTANT: This usually means the Stripe key in .env.local does not match the key used in Supabase Edge Functions');
        console.log('⚠️ Make sure both use the same Stripe account (both test or both live)');
        
        // Clear the invalid subscription ID so admin can re-create it
        await supabase
          .from('detailers')
          .update({ 
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', detailer.id);
        
        return NextResponse.json({ 
          error: 'Your subscription was not properly set up. Please contact support to resolve this issue.',
          code: 'SUBSCRIPTION_NOT_FOUND',
          details: 'The subscription ID in our database does not exist in Stripe. This may be due to a Stripe key mismatch. Support will need to re-create your subscription.'
        }, { status: 404 });
      }
      
      // Provide more specific error messages for other errors
      let errorMessage = 'Failed to retrieve payment intent';
      let errorCode = stripeError.code || 'STRIPE_ERROR';
      
      if (stripeError.message) {
        errorMessage = stripeError.message;
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: stripeError.message,
        code: errorCode
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error getting payment intent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

