import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env.local file.');
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Use getUser() instead of getSession() for more reliable authentication
  // getSession() reads from cookies which may not be immediately updated after login
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  
  // If getUser() fails, user is not authenticated
  const isAuthenticated = !authError && user !== null;

  const { pathname } = request.nextUrl;

  // Protect detailer routes
  if (pathname.startsWith('/detailer')) {
    // Allow access to pending page without active check
    if (pathname === '/detailer/pending') {
      if (!isAuthenticated) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }
      // Basic role check only
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single();
      
      if (!profile || (profile.role !== 'detailer' && profile.role !== 'admin')) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }
      // Allow access to pending page
      return supabaseResponse;
    }

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, onboarding_completed')
      .eq('id', user!.id)
      .single();

    if (profileError || !profile || (profile.role !== 'detailer' && profile.role !== 'admin')) {
      console.log('Detailer route access denied:', {
        profileError: profileError?.message,
        hasProfile: !!profile,
        role: profile?.role,
        userId: user!.id,
      });
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Admins can always access detailer routes
    if (profile.role === 'admin') {
      console.log('Admin accessing detailer route, allowing access');
      return supabaseResponse;
    }

    // Check onboarding status
    if (!profile.onboarding_completed) {
      return NextResponse.redirect(new URL('/onboard', request.url));
    }

    // Check if detailer is active
    // Use maybeSingle() to handle cases where record doesn't exist
    const { data: detailer, error: detailerError } = await supabase
      .from('detailers')
      .select('is_active')
      .eq('profile_id', user!.id)
      .maybeSingle();

    // If query failed or no detailer record, redirect to pending page
    if (detailerError || !detailer) {
      console.log('Detailer record check failed:', {
        error: detailerError?.message,
        hasRecord: !!detailer,
        userId: user!.id,
      });
      return NextResponse.redirect(new URL('/detailer/pending', request.url));
    }

    // If detailer is not active, redirect to pending page
    if (!detailer.is_active) {
      return NextResponse.redirect(new URL('/detailer/pending', request.url));
    }
  }

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  // Allow access to login page even when authenticated (for switching accounts)
  // Only redirect if there's no ?switch=true query parameter
  if (pathname.startsWith('/auth/login') && isAuthenticated) {
    const switchAccount = request.nextUrl.searchParams.get('switch');
    
    // If user explicitly wants to switch accounts, allow access to login page
    if (switchAccount === 'true') {
      return supabaseResponse;
    }

    // Otherwise, redirect authenticated users to their dashboard
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, onboarding_completed')
      .eq('id', user!.id)
      .single();

    // Check if user has a detailer record even if profile fetch failed or role isn't set
    const { data: detailerRecord } = await supabase
      .from('detailers')
      .select('is_active')
      .eq('profile_id', user!.id)
      .single();

    // If detailer record exists but profile fetch failed, redirect to pending
    if (profileError && detailerRecord) {
      return NextResponse.redirect(new URL('/detailer/pending', request.url));
    }

    // Only redirect if we successfully got the profile
    // If there's an error, let the login page handle it (might be RLS issue)
    if (profile && !profileError) {
      // If detailer record exists but role isn't set, treat as detailer
      const effectiveRole = profile.role || (detailerRecord ? 'detailer' : null);

      if (effectiveRole === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else if (effectiveRole === 'detailer') {
        // Check if detailer is active first (more important than onboarding flag)
        if (!detailerRecord || !detailerRecord.is_active) {
          return NextResponse.redirect(new URL('/detailer/pending', request.url));
        }

        // If detailer is active but onboarding_completed is false,
        // they've been approved but onboarding flag wasn't set - allow access
        if (!profile.onboarding_completed) {
          // Still allow access since they're active and approved
          return NextResponse.redirect(new URL('/detailer/dashboard', request.url));
        }

        return NextResponse.redirect(new URL('/detailer/dashboard', request.url));
      }
    }
    // If profile query failed and no detailer record, don't redirect - let user stay on login page
    // This prevents redirect loops when RLS blocks the query
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

