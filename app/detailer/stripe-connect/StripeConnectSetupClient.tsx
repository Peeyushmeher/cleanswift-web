'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StripeConnectSetupClientProps {
  detailerId: string;
  detailerName: string;
  isConnected: boolean;
  accountId: string | null;
  needsRefresh?: boolean;
}

export default function StripeConnectSetupClient({
  detailerId,
  detailerName,
  isConnected,
  accountId,
  needsRefresh = false,
}: StripeConnectSetupClientProps) {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/detailer/settings?connected=true`;
      const refreshUrl = `${window.location.origin}/detailer/stripe-connect?refresh=true`;

      const response = await fetch('/api/stripe-connect/create-account-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: returnUrl,
          refresh_url: refreshUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account link');
      }

      const data = await response.json();
      
      if (data.account_link_url) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.account_link_url;
      } else {
        throw new Error('No account link URL received');
      }
    } catch (err) {
      console.error('Error connecting Stripe:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe account');
      setIsConnecting(false);
    }
  };

  // Auto-connect if refresh is needed
  useEffect(() => {
    if (needsRefresh && !isConnecting && accountId) {
      handleConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsRefresh]);

  if (isConnected) {
    return (
      <div className="min-h-screen bg-[#050B12] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/detailer/settings"
              className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to Settings
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">Stripe Connect Account</h1>
            <p className="text-[#C6CFD9]">Your payment account is connected and ready to receive payouts</p>
          </div>

          {/* Success Card */}
          <div className="bg-[#0A1A2F] border border-[#32CE7A]/20 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-[#32CE7A]/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#32CE7A]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white mb-2">Account Connected</h2>
                <p className="text-[#C6CFD9] mb-4">
                  Your Stripe Connect account is set up and ready to receive payouts. You'll receive payments 
                  directly to your connected bank account after completing jobs.
                </p>
                {accountId && (
                  <a
                    href={`https://dashboard.stripe.com/connect/accounts/${accountId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#32CE7A] hover:text-[#6FF0C4] transition-colors"
                  >
                    View in Stripe Dashboard
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B12] p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/detailer/settings"
            className="text-[#C6CFD9] hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to Settings
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Payment Account</h1>
          <p className="text-[#C6CFD9]">Connect your Stripe account to receive payouts for completed jobs</p>
        </div>

        {/* Instructions */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">How It Works</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#32CE7A]/20 rounded-full flex items-center justify-center text-[#32CE7A] font-semibold">
                1
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Connect Your Stripe Account</h3>
                <p className="text-[#C6CFD9] text-sm">
                  Click the button below to securely connect your Stripe account. You'll be redirected to Stripe's 
                  secure onboarding page.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#32CE7A]/20 rounded-full flex items-center justify-center text-[#32CE7A] font-semibold">
                2
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Complete Your Profile</h3>
                <p className="text-[#C6CFD9] text-sm">
                  Provide your business information, bank account details, and verify your identity. 
                  This process typically takes 5-10 minutes.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#32CE7A]/20 rounded-full flex items-center justify-center text-[#32CE7A] font-semibold">
                3
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Start Receiving Payouts</h3>
                <p className="text-[#C6CFD9] text-sm">
                  Once your account is verified, you'll automatically receive payouts to your bank account 
                  after completing jobs. Payouts typically arrive within 2-3 business days.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What You'll Need */}
        <div className="bg-[#0A1A2F] border border-white/5 rounded-xl p-8 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">What You'll Need</h2>
          <ul className="space-y-2 text-[#C6CFD9]">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-[#32CE7A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Business information (name, address, tax ID if applicable)</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-[#32CE7A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Bank account details (routing number, account number)</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-[#32CE7A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Government-issued ID for identity verification</span>
            </li>
          </ul>
        </div>

        {/* Security Notice */}
        <div className="bg-[#050B12] border border-white/5 rounded-xl p-6 mb-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[#32CE7A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-2.952M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <h3 className="text-white font-medium mb-1">Secure & Trusted</h3>
              <p className="text-[#C6CFD9] text-sm">
                Your information is securely processed by Stripe, a PCI-compliant payment processor trusted by 
                millions of businesses worldwide. CleanSwift never stores your banking information.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Connect Button */}
        <div className="flex justify-center">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-8 py-4 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Connect Stripe Account
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

