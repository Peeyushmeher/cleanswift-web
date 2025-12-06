import { createClient } from '@/lib/supabase/server';
import { requireDetailer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StripeConnectSetupClient from './StripeConnectSetupClient';

export default async function StripeConnectSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ refresh?: string; connected?: string }>;
}) {
  const profile = await requireDetailer();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const params = await searchParams;

  // Get detailer record - use maybeSingle to handle cases where record doesn't exist yet
  const { data: detailer } = await supabase
    .from('detailers')
    .select('id, full_name, stripe_connect_account_id')
    .eq('profile_id', user.id)
    .maybeSingle();

  // If no detailer record exists, we still allow access to the setup page
  // The user might be setting up their account
  if (!detailer) {
    // Try to get detailer via RPC as fallback
    const { data: rpcDetailer } = await supabase.rpc('get_detailer_by_profile', {
      p_profile_id: user.id,
    });
    
    if (!rpcDetailer) {
      // No detailer record at all - redirect to settings
      redirect('/detailer/settings');
    }
    
    // Use RPC data
    return (
      <StripeConnectSetupClient
        detailerId={rpcDetailer.id}
        detailerName={rpcDetailer.full_name || profile.full_name || 'Detailer'}
        isConnected={false}
        accountId={null}
        needsRefresh={params.refresh === 'true'}
      />
    );
  }

  // If refresh parameter is present, create a new account link
  const needsRefresh = params.refresh === 'true';

  return (
    <StripeConnectSetupClient
      detailerId={detailer.id}
      detailerName={detailer.full_name}
      isConnected={!!detailer.stripe_connect_account_id}
      accountId={detailer.stripe_connect_account_id}
      needsRefresh={needsRefresh}
    />
  );
}
