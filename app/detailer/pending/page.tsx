import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navigation from '@/app/components/Navigation';
import Footer from '@/app/components/Footer';
import PendingApprovalMessage from '@/app/components/onboard/PendingApprovalMessage';

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, onboarding_completed')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    redirect('/auth/login');
  }

  // If not a detailer, redirect
  if (profile.role !== 'detailer' && profile.role !== 'admin') {
    redirect('/');
  }

  // If onboarding not completed, redirect to onboarding
  if (!profile.onboarding_completed) {
    redirect('/onboard');
  }

  // Get detailer record to check if active
  const { data: detailer } = await supabase
    .from('detailers')
    .select('id, is_active, full_name, created_at')
    .eq('profile_id', profile.id)
    .single();

  // If detailer is active, redirect to dashboard
  if (detailer?.is_active) {
    redirect('/detailer/dashboard');
  }

  // If no detailer record exists, redirect to onboarding
  if (!detailer) {
    redirect('/onboard');
  }

  // Calculate days since submission
  const submissionDate = new Date(detailer.created_at);
  const daysSinceSubmission = Math.floor(
    (Date.now() - submissionDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <main className="min-h-screen">
      <Navigation />
      
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
        
        <div className="max-w-2xl mx-auto px-6">
          <PendingApprovalMessage />
          
          <div className="mt-8 card p-6">
            <h3 className="font-semibold mb-4">Application Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Name:</dt>
                <dd className="font-medium">{detailer.full_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Submitted:</dt>
                <dd className="font-medium">
                  {submissionDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Days Pending:</dt>
                <dd className="font-medium">{daysSinceSubmission} day{daysSinceSubmission !== 1 ? 's' : ''}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              Questions? <a href="mailto:support@cleanswift.com" className="text-cyan-400 hover:underline">Contact support</a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
