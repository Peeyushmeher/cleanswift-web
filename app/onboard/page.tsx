import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navigation from '@/app/components/Navigation';
import Footer from '@/app/components/Footer';
import Link from 'next/link';

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const BuildingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01"/>
    <path d="M16 6h.01"/>
    <path d="M12 6h.01"/>
    <path d="M12 10h.01"/>
    <path d="M12 14h.01"/>
    <path d="M16 10h.01"/>
    <path d="M16 14h.01"/>
    <path d="M8 10h.01"/>
    <path d="M8 14h.01"/>
  </svg>
);

export default async function OnboardingPage() {
  const supabase = await createClient();
  
  // Check authentication - but allow unauthenticated users to start onboarding
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // If user is logged in and has completed onboarding, redirect to home
  // They'll need to wait for admin approval and log in again
  if (!error && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, onboarding_completed')
      .eq('id', user.id)
      .single();

    if (profile?.onboarding_completed) {
      // After onboarding, users are signed out and redirected to home
      // They'll log in again after admin approval
      redirect('/');
    }
  }
  
  // Allow both authenticated and unauthenticated users to proceed

  // If user already has detailer role but hasn't completed onboarding, allow them to continue
  // (This handles edge cases where role was set but onboarding wasn't completed)

  return (
    <main className="min-h-screen">
      <Navigation />
      
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none z-0" />
        
        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-cyan-400 font-medium mb-4">Get Started</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Choose Your <span className="text-accent-gradient">Onboarding Path</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Select whether you&apos;re applying as a solo detailer or representing an organization with multiple detailers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Solo Detailer Option */}
            <Link href="/onboard/detailer" className="group">
              <div className="card p-8 h-full hover:border-cyan-500/50 transition-all cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <UserIcon />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">Solo Detailer</h3>
                <p className="text-slate-400 mb-6">
                  Perfect if you&apos;re an independent detailer working on your own. You&apos;ll manage your own bookings, schedule, and earnings.
                </p>
                <ul className="space-y-2 text-sm text-slate-300 mb-6">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Manage your own bookings
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Set your own schedule
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Keep 100% of your earnings
                  </li>
                </ul>
                <div className="text-cyan-400 font-medium group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                  Get Started
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </Link>

            {/* Organization Option */}
            <Link href="/onboard/organization" className="group">
              <div className="card p-8 h-full hover:border-cyan-500/50 transition-all cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <BuildingIcon />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">Organization / Team</h3>
                <p className="text-slate-400 mb-6">
                  Ideal for businesses with multiple detailers. You&apos;ll manage teams, assign jobs, and track organization-wide performance.
                </p>
                <ul className="space-y-2 text-sm text-slate-300 mb-6">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Manage multiple detailers
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Assign jobs to team members
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Track organization earnings
                  </li>
                </ul>
                <div className="text-cyan-400 font-medium group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                  Get Started
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-500 text-sm">
              Need help deciding? <Link href="/for-detailers" className="text-cyan-400 hover:underline">Learn more about both options</Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
