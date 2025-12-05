'use client';

import { useState, Suspense } from 'react';
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
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);

    try {
      // Trim email and password to avoid whitespace issues
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        setError('Please enter both email and password.');
        setLoading(false);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        console.error('Login error:', signInError);
        
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
        setError('Login failed: No user data returned');
        setLoading(false);
        return;
      }

      // Fetch user profile to determine role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, onboarding_completed')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        // Default to detailer dashboard if profile fetch fails
        window.location.href = '/detailer/dashboard';
        return;
      }

      // If there's a redirect parameter, use it (for onboarding flow)
      if (redirectTo) {
        window.location.href = redirectTo;
        return;
      }

      // Redirect based on role
      if (profile?.role === 'admin') {
        window.location.href = '/admin/dashboard';
      } else if (profile?.role === 'detailer') {
        // Check if detailer is active before redirecting to dashboard
        const { data: detailer } = await supabase
          .from('detailers')
          .select('is_active')
          .eq('profile_id', data.user.id)
          .single();

        // Check onboarding status
        if (!profile.onboarding_completed) {
          window.location.href = '/onboard';
          return;
        }

        // Check if detailer is active
        if (!detailer || !detailer.is_active) {
          // Detailer is pending approval
          window.location.href = '/detailer/pending';
          return;
        }

        // Detailer is active, redirect to dashboard
        window.location.href = '/detailer/dashboard';
      } else {
        // Regular users - redirect to onboarding if they don't have a role yet
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
          
          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
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

            <div>
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

            <div>
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
