'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { UserProfile } from '@/lib/auth';

type DetailerMode = 'solo' | 'organization';

interface SidebarProps {
  mode: DetailerMode;
  profile: UserProfile;
}

const soloNavigation = [
  { name: 'Home', href: '/detailer/dashboard', icon: '🏠' },
  { name: 'Jobs', href: '/detailer/bookings', icon: '📋' },
  { name: 'Schedule', href: '/detailer/schedule', icon: '📅' },
  { name: 'Earnings', href: '/detailer/earnings', icon: '💰' },
  { name: 'Reviews', href: '/detailer/reviews', icon: '⭐' },
  { name: 'Settings', href: '/detailer/settings', icon: '⚙️' },
];

const orgNavigation = [
  { name: 'Home', href: '/detailer/dashboard', icon: '🏠' },
  { name: 'Jobs', href: '/detailer/bookings', icon: '📋' },
  { name: 'Schedule', href: '/detailer/schedule', icon: '📅' },
  { name: 'Teams', href: '/detailer/teams', icon: '👥' },
  { name: 'Members', href: '/detailer/members', icon: '👤' },
  { name: 'Earnings', href: '/detailer/earnings', icon: '💰' },
  { name: 'Reviews', href: '/detailer/reviews', icon: '⭐' },
  { name: 'Settings', href: '/detailer/settings', icon: '⚙️' },
];

export default function Sidebar({ mode, profile }: SidebarProps) {
  const navigation = mode === 'organization' ? orgNavigation : soloNavigation;
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#0A1A2F] border border-white/5 rounded-lg"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-[#0A1A2F] border-r border-white/5
          transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          transition-transform duration-200 ease-in-out
          flex flex-col
        `}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-white/5">
          <h1 className="text-xl font-bold text-white">CleanSwift</h1>
          <p className="text-sm text-[#C6CFD9] mt-1">
            {mode === 'organization' ? 'Organization Dashboard' : 'Detailer Dashboard'}
          </p>
          {mode === 'organization' && (
            <div className="mt-2 px-2 py-1 bg-[#32CE7A]/10 border border-[#32CE7A]/20 rounded text-xs text-[#32CE7A]">
              Organization Mode
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors
                  ${
                    isActive
                      ? 'bg-[#32CE7A]/20 text-[#32CE7A] border border-[#32CE7A]/40'
                      : 'text-[#C6CFD9] hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-[#32CE7A]/20 flex items-center justify-center">
              <span className="text-[#32CE7A] font-semibold">
                {profile.full_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-[#C6CFD9] truncate capitalize">
                {mode === 'organization' ? 'Organization' : 'Solo Detailer'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}

