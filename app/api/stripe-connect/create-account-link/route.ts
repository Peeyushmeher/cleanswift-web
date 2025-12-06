import { createClient } from '@/lib/supabase/server';
import { requireDetailer } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and is a detailer
    const profile = await requireDetailer();
    
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's JWT token for Edge Function authentication (needed before any Edge Function calls)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json({ error: 'Not authenticated. Please sign in again.' }, { status: 401 });
    }

    const body = await request.json();
    const { return_url, refresh_url } = body;

    // Get detailer record - use maybeSingle to handle cases where record doesn't exist
    // Try direct query first
    let detailerId: string | null = null;
    const { data: detailer, error: detailerError } = await supabase
      .from('detailers')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!detailerError && detailer) {
      detailerId = detailer.id;
      console.log('Found detailer via direct query:', detailerId);
    } else {
      console.log('Direct query failed, trying RPC. Error:', detailerError?.message);
      // Try RPC as fallback
      const { data: rpcDetailer, error: rpcError } = await supabase.rpc('get_detailer_by_profile', {
        p_profile_id: user.id,
      });
      
      if (rpcError) {
        console.error('RPC error:', rpcError);
      }
      
      if (!rpcError && rpcDetailer) {
        detailerId = rpcDetailer.id;
        console.log('Found detailer via RPC:', detailerId);
      }
    }

    // If no detailer record found, return helpful error
    if (!detailerId) {
      console.error('No detailer record found for user:', {
        userId: user.id,
        userEmail: user.email,
        profileRole: profile.role,
        profileId: profile.id,
        detailerError: detailerError?.message,
        detailerErrorCode: detailerError?.code,
        hasDetailerFromQuery: !!detailer,
      });
      return NextResponse.json({ 
        error: 'Detailer profile not found. Please complete your onboarding first. If you have already completed onboarding, please contact support.' 
      }, { status: 404 });
    }

    // Call Supabase Edge Function to create Connect account and link
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 500 });
    }

    const functionUrl = `${supabaseUrl}/functions/v1/create-stripe-connect-account`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        detailer_id: detailerId,
        return_url,
        refresh_url,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to create Stripe Connect account' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating Stripe Connect account link:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

