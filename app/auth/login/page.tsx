'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || null;
  const message = searchParams.get('message');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email?: string; name?: string } | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  // Check if user is already logged in (client-side only to avoid hydration mismatch)
  useEffect(() => {
    setMounted(true);
    const checkCurrentUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({
          email: user.email || profile?.email,
          name: profile?.full_name || user.email?.split('@')[0],
        });
      }
    };
    checkCurrentUser();
  }, [supabase]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsSigningOut(false);
    // Clear form
    setEmail('');
    setPassword('');
  };

  // Check if subscription payment is needed
  const checkSubscriptionPayment = async () => {
    try {
      const response = await fetch('/api/detailer/subscription/check-payment');
      
      if (response.ok) {
        const data = await response.json();
        if (data.needsPayment) {
          console.log('⚠ Subscription payment required, redirecting to payment page');
          window.location.href = '/detailer/subscription/payment';
          return;
        }
      }
      
      // Payment not needed or check failed, proceed to dashboard
      console.log('✓ No subscription payment needed, redirecting to dashboard');
      window.location.href = '/detailer/dashboard';
    } catch (error) {
      console.error('Error checking subscription payment:', error);
      // On error, proceed to dashboard (payment check will happen there)
      window.location.href = '/detailer/dashboard';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== LOGIN FLOW STARTED ===');
    setLoading(true);
    setError(null);

    try {
      // If user is already logged in, sign them out first
      if (currentUser) {
        console.log('Current user detected, signing out first:', currentUser);
        await supabase.auth.signOut();
        setCurrentUser(null);
      }

      // Trim email and password to avoid whitespace issues
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      console.log('Login attempt for email:', trimmedEmail);

      if (!trimmedEmail || !trimmedPassword) {
        console.warn('Login validation failed: missing email or password');
        setError('Please enter both email and password.');
        setLoading(false);
        return;
      }

      console.log('Attempting authentication...');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        console.error('Authentication failed:', {
          error: signInError,
          message: signInError.message,
          code: signInError.code,
        });
        
        // Provide more helpful error messages
        if (signInError.message.includes('Invalid login credentials') || signInError.message.includes('Email not confirmed')) {
          setError('Invalid email or password. Please check your credentials. If you just created your account, make sure you confirmed your email.');
        } else {
          setError(signInError.message || 'Failed to sign in. Please check your credentials.');
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        console.error('Authentication succeeded but no user data returned');
        setError('Login failed: No user data returned');
        setLoading(false);
        return;
      }

      console.log('Authentication successful. User ID:', data.user.id);

      // Clear current user state since we're signing in with a new account
      setCurrentUser(null);

      // Fetch user profile to determine role
      console.log('Fetching user profile...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, onboarding_completed')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', {
          error: profileError,
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
        });
        
        // Check if detailer record exists even if profile fetch failed
        console.log('Profile fetch failed, checking for detailer record as fallback...');
        const { data: detailerCheck, error: detailerCheckError } = await supabase
          .from('detailers')
          .select('id, is_active')
          .eq('profile_id', data.user.id)
          .maybeSingle();
        
        console.log('Detailer check result:', { detailerCheck, detailerCheckError });
        
        if (detailerCheck) {
          // Detailer record exists, redirect to pending (profile might need fixing)
          console.log('Detailer record found despite profile error, redirecting to pending');
          window.location.href = '/detailer/pending';
        } else {
          // No detailer record, redirect to onboarding
          console.log('No detailer record found, redirecting to onboarding');
          window.location.href = '/onboard';
        }
        return;
      }

      console.log('Profile fetched successfully:', {
        role: profile?.role,
        onboardingCompleted: profile?.onboarding_completed,
        profileId: profile?.id,
      });

      // If there's a redirect parameter, use it (for onboarding flow)
      if (redirectTo) {
        console.log('Redirect parameter found, redirecting to:', redirectTo);
        window.location.href = redirectTo;
        return;
      }

      // Check if user has a detailer record even if role isn't set
      // Use maybeSingle() instead of single() to handle cases where record doesn't exist
      let detailerRecord: { is_active: boolean } | null = null;
      let detailerError: any = null;
      
      const { data: detailerData, error: detailerQueryError } = await supabase
        .from('detailers')
        .select('is_active')
        .eq('profile_id', data.user.id)
        .maybeSingle();

      detailerRecord = detailerData;
      detailerError = detailerQueryError;

      // If query failed, try using RPC function as fallback
      if (detailerError && !detailerRecord) {
        console.warn('Detailer query failed, trying RPC fallback:', detailerError);
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_detailer_by_profile', {
            p_profile_id: data.user.id,
          });
          
          if (!rpcError && rpcData) {
            console.log('RPC fallback succeeded, found detailer:', rpcData);
            detailerRecord = { is_active: rpcData.is_active || false };
            detailerError = null;
          } else {
            console.warn('RPC fallback also failed:', rpcError);
          }
        } catch (rpcErr) {
          console.error('RPC fallback exception:', rpcErr);
        }
      }

      // Log for debugging
      console.log('Login redirect check:', {
        userId: data.user.id,
        profileRole: profile?.role,
        onboardingCompleted: profile?.onboarding_completed,
        detailerRecord: detailerRecord,
        detailerRecordIsActive: detailerRecord?.is_active,
        detailerError: detailerError?.message || detailerError?.code,
        detailerErrorDetails: detailerError,
      });

      // If detailer record exists but role isn't set, treat as detailer
      const effectiveRole = profile?.role || (detailerRecord ? 'detailer' : null);
      
      console.log('Effective role determined:', effectiveRole, {
        profileRole: profile?.role,
        hasDetailerRecord: !!detailerRecord,
      });

      // Redirect based on role
      console.log('=== REDIRECT DECISION ===');
      console.log('Effective role:', effectiveRole);
      console.log('Detailer record:', detailerRecord);
      console.log('Profile onboarding completed:', profile?.onboarding_completed);
      
      if (effectiveRole === 'admin') {
        console.log('✓ User is admin, redirecting to admin dashboard');
        window.location.href = '/admin/dashboard';
      } else if (effectiveRole === 'detailer') {
        console.log('✓ User is detailer, checking status...');
        
        // If detailer record exists but onboarding_completed is false, 
        // they likely completed onboarding but the flag wasn't set
        // Check if detailer is active first (more important check)
        if (!detailerRecord) {
          console.error('✗ Detailer record not found for user:', data.user.id);
          console.error('  Profile role:', profile?.role);
          console.error('  This should not happen if role is detailer');
          // If profile says detailer but no record, redirect to pending
          window.location.href = '/detailer/pending';
          return;
        }

        console.log('  Detailer record found, is_active:', detailerRecord.is_active);
        
        if (!detailerRecord.is_active) {
          // Detailer is pending approval
          console.log('✗ Detailer not active, redirecting to /detailer/pending');
          window.location.href = '/detailer/pending';
          return;
        }

        // If detailer is active but onboarding_completed is false, 
        // they've been approved but onboarding flag wasn't set - allow access
        if (!profile?.onboarding_completed) {
          console.warn('⚠ Detailer is active but onboarding_completed is false. Allowing access to dashboard.');
          // Still redirect to dashboard since they're active and approved
          // But check subscription payment first
          await checkSubscriptionPayment();
          return;
        }

        // Detailer is active and onboarding completed, check subscription payment before redirecting
        console.log('✓ Detailer is active and onboarding completed, checking subscription payment...');
        await checkSubscriptionPayment();
      } else {
        // Regular users or no role
        console.log('No detailer role found. Profile:', profile);
        
        // Before redirecting to /onboard, check if user has completed onboarding
        // If they have, they shouldn't go to onboarding (which would redirect to home)
        if (profile?.onboarding_completed) {
          console.warn('User has completed onboarding but no detailer role. Checking for detailer record again...');
          
          // Try one more time to find detailer record using RPC function
          try {
            const { data: rpcDetailer, error: rpcError } = await supabase.rpc('get_detailer_by_profile', {
              p_profile_id: data.user.id,
            });
            
            if (!rpcError && rpcDetailer) {
              console.log('Found detailer via RPC after onboarding check:', rpcDetailer);
              
              // User is a detailer, check if active
              if (rpcDetailer.is_active) {
                console.log('Detailer is active, redirecting to dashboard');
                window.location.href = '/detailer/dashboard';
                return;
              } else {
                console.log('Detailer is not active, redirecting to pending');
                window.location.href = '/detailer/pending';
                return;
              }
            }
          } catch (rpcErr) {
            console.error('RPC check failed:', rpcErr);
          }
          
          // If we get here, user completed onboarding but isn't a detailer
          // This shouldn't happen, but redirect to home instead of onboarding
          console.error('User completed onboarding but is not a detailer. Redirecting to home.');
          window.location.href = '/';
          return;
        }
        
        // User hasn't completed onboarding, redirect to onboarding
        console.log('User has not completed onboarding, redirecting to /onboard');
        window.location.href = '/onboard';
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative w-full max-w-md z-10">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <SparklesIcon />
            </div>
            <span className="font-display text-2xl font-bold">CleanSwift</span>
          </Link>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-400 mb-4">
            Sign in to access your dashboard
          </p>
          <Link 
            href="/onboard" 
            className="btn-primary inline-flex items-center gap-2 text-sm py-2 px-4"
          >
            New? Sign Up for Onboarding
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </Link>
        </div>

        {/* Login Card */}
        <div className="card p-8 lg:p-10 relative">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
          
          <form onSubmit={handleLogin} className="space-y-6 relative z-10" suppressHydrationWarning>
            {mounted && currentUser && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-3 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Currently signed in as {currentUser.name || currentUser.email}</p>
                    <p className="text-xs text-blue-300 mt-1">Sign in with a different account below, or sign out first.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="ml-4 px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors disabled:opacity-50"
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            )}
            {message && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
                {error}
              </div>
            )}

            <div suppressHydrationWarning>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-slate-300">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                suppressHydrationWarning
                className="input"
                placeholder="you@example.com"
              />
            </div>

            <div suppressHydrationWarning>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                suppressHydrationWarning
                className="input"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-8 pt-6 border-t border-slate-800 relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
              <Link href="/" className="text-slate-400 hover:text-cyan-400 transition-colors">
                ← Back to Home
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-slate-600">Don't have an account?</span>
                <Link href="/onboard" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Additional info */}
        <p className="text-center text-slate-500 text-sm mt-6">
          For detailers and admins only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
