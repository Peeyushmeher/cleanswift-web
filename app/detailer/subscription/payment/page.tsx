import { createClient } from '@/lib/supabase/server';
import { requireDetailer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PaymentForm from './PaymentForm';
import { getSubscriptionMonthlyPrice } from '@/lib/platform-settings';
import Stripe from 'stripe';

export default async function SubscriptionPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;

  // If payment was successful, redirect to dashboard
  if (params.success === 'true') {
    redirect('/detailer/dashboard?payment=success');
  }

  if (!user) {
    redirect('/auth/login');
  }

  // Get detailer record
  const { data: detailer } = await supabase
    .from('detailers')
    .select('id, pricing_model, stripe_subscription_id, full_name')
    .eq('profile_id', user.id)
    .single();

  if (!detailer) {
    redirect('/detailer/dashboard');
  }

  // Check if detailer is on subscription model
  if (detailer.pricing_model !== 'subscription') {
    redirect('/detailer/dashboard');
  }

  // If no subscription ID exists, subscription wasn't created - show error
  if (!detailer.stripe_subscription_id) {
    return (
      <div className="min-h-screen bg-[#050B12] p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Subscription Setup Required</h1>
            <p className="text-[#C6CFD9]">
              Your subscription was not properly set up during account approval.
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-red-400 mb-2">Subscription Not Found</h2>
                <p className="text-red-300/80 mb-4">
                  Your subscription was not properly created when your account was approved. Please contact support to resolve this issue.
                </p>
                <p className="text-red-300/60 text-sm mb-6">
                  Support will need to re-create your subscription so you can complete payment and start using the platform.
                </p>
                <div className="flex gap-3">
                  <a
                    href="/detailer/dashboard"
                    className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Go to Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check payment status - if already paid, redirect to dashboard
  if (detailer.stripe_subscription_id) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, {
          apiVersion: '2025-12-15.clover',
        });

        const subscription = await stripe.subscriptions.retrieve(
          detailer.stripe_subscription_id,
          {
            expand: ['latest_invoice.payment_intent'],
          }
        );

        // If subscription is active and payment is complete, redirect
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          const latestInvoice = subscription.latest_invoice;
          if (latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
            const paymentIntent = (latestInvoice as any).payment_intent;
            if (paymentIntent && typeof paymentIntent === 'object' && 'status' in paymentIntent) {
              const paymentIntentStatus = paymentIntent.status as string;
              if (paymentIntentStatus === 'succeeded') {
                redirect('/detailer/dashboard');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
        // Continue to payment page if check fails
      }
    }
  }

  // Get subscription price for display
  const subscriptionPrice = await getSubscriptionMonthlyPrice();

  return (
    <div className="min-h-screen bg-[#050B12] p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Subscription</h1>
          <p className="text-[#C6CFD9]">
            Your account has been approved! Please complete your subscription payment to start using the platform.
          </p>
        </div>

        {/* Payment Card */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Subscription Details</h2>
            <div className="space-y-2 text-[#C6CFD9]">
              <div className="flex justify-between">
                <span>Monthly Subscription</span>
                <span className="text-white font-medium">${subscriptionPrice.toFixed(2)} CAD</span>
              </div>
              <div className="text-sm text-slate-500">
                Billed monthly • Cancel anytime
              </div>
            </div>
          </div>

          <PaymentForm detailerId={detailer.id} />
        </div>
      </div>
    </div>
  );
}

