'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Force dynamic rendering to prevent static generation
export const dynamic = 'force-dynamic';

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail) {
        setError('Please enter your email address.');
        setLoading(false);
        return;
      }

      // Create Supabase client only when needed (client-side only)
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        console.error('Password reset error:', resetError);
        setError(resetError.message || 'Failed to send password reset email. Please try again.');
        setLoading(false);
        return;
      }

      // Success - show success message
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error('Unexpected password reset error:', err);
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

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-white mb-2 hover:text-cyan-400 transition-colors">
            <SparklesIcon />
            CleanSwift
          </Link>
          <p className="text-slate-400 text-sm">Reset your password</p>
        </div>

        {/* Back to Login */}
        <div className="mb-6 text-center">
          <Link
            href="/auth/login" 
            className="text-cyan-400 hover:text-cyan-300 text-sm inline-flex items-center gap-1 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            Back to Login
          </Link>
        </div>

        {/* Reset Password Card */}
        <div className="card p-8 lg:p-10 relative">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
          
          <form onSubmit={handleResetPassword} className="space-y-6 relative z-10">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
                <div className="font-semibold mb-1">Password reset email sent!</div>
                <div className="text-sm text-green-300/80">
                  Check your email ({email}) for a password reset link. The link will expire in 1 hour.
                </div>
              </div>
            )}

            {!success && (
              <>
                <div>
                  <p className="text-slate-300 text-sm mb-4">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  <label htmlFor="email" className="block text-sm font-medium mb-2 text-slate-300">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    suppressHydrationWarning
                    className="input"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || success}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14"/>
                        <path d="m12 5 7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>
              </>
            )}

            {success && (
              <div className="text-center">
                <Link
                  href="/auth/login"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  Back to Login
                </Link>
              </div>
            )}
          </form>
        </div>

        {/* Sign Up Link */}
        {!success && (
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link
                href="/onboard" 
                className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
              >
                Sign Up for Onboarding
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
