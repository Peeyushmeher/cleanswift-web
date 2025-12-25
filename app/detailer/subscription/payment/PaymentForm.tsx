'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Link from 'next/link';

interface PaymentFormProps {
  detailerId: string;
}

interface CheckoutFormProps {
  detailerId: string;
  clientSecret: string;
}

function CheckoutForm({ detailerId, clientSecret }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Confirm payment with Stripe
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/detailer/subscription/payment?success=true`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        // Payment failed
        setError(submitError.message || 'Payment failed. Please try again.');
        setIsLoading(false);
      } else if (paymentIntent) {
        // Check payment intent status
        if (paymentIntent.status === 'succeeded') {
          // Payment successful - redirect to dashboard
          router.push('/detailer/dashboard?payment=success');
        } else if (paymentIntent.status === 'requires_action') {
          // Payment requires additional action (3D Secure, etc.)
          // Stripe will handle the redirect automatically
          setError('Payment requires additional verification. Please complete the verification.');
        } else {
          setError(`Payment status: ${paymentIntent.status}. Please try again.`);
          setIsLoading(false);
        }
      } else {
        // No payment intent returned - check status manually
        const { error: paymentError, paymentIntent: retrievedIntent } = await stripe.retrievePaymentIntent(clientSecret);
        
        if (paymentError || !retrievedIntent) {
          setError('Payment verification failed. Please contact support.');
          setIsLoading(false);
        } else if (retrievedIntent.status === 'succeeded') {
          // Payment successful - redirect to dashboard
          router.push('/detailer/dashboard?payment=success');
        } else {
          setError(`Payment status: ${retrievedIntent.status}. Please try again.`);
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="border border-white/10 rounded-lg p-4">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <div className="flex items-center justify-between pt-4">
        <Link
          href="/detailer/dashboard"
          className="text-[#C6CFD9] hover:text-white text-sm transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!stripe || !elements || isLoading}
          className="px-6 py-2.5 bg-[#32CE7A] hover:bg-[#6FF0C4] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </>
          ) : (
            <>
              Complete Payment
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function PaymentForm({ detailerId }: PaymentFormProps) {
  // Get Stripe publishable key from environment
  // Note: This should be set in .env.local as NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isFetchingSecret, setIsFetchingSecret] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!stripePublishableKey) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-400 text-sm">
          Stripe is not configured. Please contact support.
        </p>
      </div>
    );
  }

  // Fetch payment intent client secret
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    async function fetchClientSecret() {
      if (!isMounted) return;
      
      try {
        console.log(`Fetching payment intent (attempt ${retryCount + 1}/${maxRetries})...`);
        const response = await fetch('/api/detailer/subscription/payment-intent');
        
        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error || 'Failed to get payment details';
          const errorCode = errorData.code;
          
          console.error('Payment intent fetch failed:', errorMessage, errorCode);
          
          // Handle specific error codes
          if (errorCode === 'INVOICE_NOT_READY' && retryCount < maxRetries && isMounted) {
            retryCount++;
            console.log(`Retrying in 2 seconds... (${retryCount}/${maxRetries})`);
            // Retry after a short delay
            timeoutId = setTimeout(() => {
              if (isMounted) {
                fetchClientSecret();
              }
            }, 2000);
            return;
          }
          
          if (isMounted) {
            throw new Error(errorMessage);
          }
          return;
        }

        const data = await response.json();
        console.log('Payment intent data received:', { hasClientSecret: !!data.clientSecret });
        
        if (!data.clientSecret) {
          if (isMounted) {
            throw new Error('No payment details received from server');
          }
          return;
        }
        
        if (isMounted) {
          setClientSecret(data.clientSecret);
          setIsFetchingSecret(false);
        }
      } catch (err) {
        console.error('Error fetching payment intent:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load payment form');
          setIsFetchingSecret(false);
        }
      }
    }

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isMounted && isFetchingSecret) {
        console.error('Payment intent fetch timed out after 30 seconds');
        setError('Payment form is taking too long to load. Please refresh the page or contact support.');
        setIsFetchingSecret(false);
      }
    }, 30000); // 30 second timeout

    fetchClientSecret();
    
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const stripePromise = loadStripe(stripePublishableKey);

  // Show loading state
  if (isFetchingSecret) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#32CE7A]"></div>
        <span className="ml-3 text-[#C6CFD9]">Loading payment form...</span>
      </div>
    );
  }

  // Show error state
  if (error || !clientSecret) {
    const isSubscriptionNotFound = error?.includes('subscription was not properly set up') || 
                                  error?.includes('Subscription not found') || 
                                  error?.includes('SUBSCRIPTION_NOT_FOUND');
    
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400 font-medium mb-2">
          {error || 'Failed to load payment form'}
        </p>
        <p className="text-red-300/80 text-sm mb-4">
          {isSubscriptionNotFound 
            ? 'Your subscription was not properly set up during account approval. Please contact support to resolve this issue.'
            : 'If this issue persists, please contact support or try refreshing the page.'}
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            Refresh Page
          </button>
          {!isSubscriptionNotFound && (
            <button
              onClick={() => {
                setError(null);
                setIsFetchingSecret(true);
                window.location.reload();
              }}
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Only render Elements when we have clientSecret
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#32CE7A',
            colorBackground: '#0A1A2F',
            colorText: '#FFFFFF',
            colorDanger: '#EF4444',
            fontFamily: 'system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
        },
      }}
    >
      <CheckoutForm 
        detailerId={detailerId} 
        clientSecret={clientSecret}
      />
    </Elements>
  );
}

