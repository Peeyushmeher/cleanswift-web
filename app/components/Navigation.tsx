'use client';

import Link from 'next/link';

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);

export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
            <SparklesIcon />
          </div>
          <span className="font-display text-xl font-bold">CleanSwift</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/how-it-works" className="text-slate-300 hover:text-white transition-colors">
            How It Works
          </Link>
          <Link href="/for-detailers" className="text-slate-300 hover:text-white transition-colors">
            For Detailers
          </Link>
          <Link href="/#faq" className="text-slate-300 hover:text-white transition-colors">
            FAQ
          </Link>
          <Link href="/auth/login?switch=true" className="btn-secondary text-sm py-2 px-5">
            Sign In
          </Link>
          <Link href="/onboard" className="btn-primary text-sm py-2 px-5">
            Apply as Detailer
          </Link>
        </div>
      </div>
    </nav>
  );
}
