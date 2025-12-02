'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Login error:', signInError);
        setError(signInError.message || 'Failed to sign in. Please check your credentials.');
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
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        // Default to detailer dashboard if profile fetch fails
        window.location.href = '/detailer/dashboard';
        return;
      }

      // Redirect based on role
      if (profile?.role === 'admin') {
        window.location.href = '/admin/dashboard';
      } else if (profile?.role === 'detailer') {
        window.location.href = '/detailer/dashboard';
      } else {
        // Regular users shouldn't be logging in here, but handle gracefully
        setError('This portal is for detailers and admins only.');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050B12] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0A1A2F] rounded-2xl border border-white/5 p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">CleanSwift</h1>
            <p className="text-[#C6CFD9]">Detailer & Admin Dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#C6CFD9] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                suppressHydrationWarning
                className="w-full px-4 py-3 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#6FF0C4] focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#C6CFD9] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                suppressHydrationWarning
                className="w-full px-4 py-3 bg-[#050B12] border border-white/10 rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#6FF0C4] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#32CE7A] hover:bg-[#2AB869] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

