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
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Admins can always access
    if (profile.role === 'admin') {
      return supabaseResponse;
    }

    // Check onboarding status
    if (!profile.onboarding_completed) {
      return NextResponse.redirect(new URL('/onboard', request.url));
    }

    // Check if detailer is active
    const { data: detailer } = await supabase
      .from('detailers')
      .select('is_active')
      .eq('profile_id', user!.id)
      .single();

    // If no detailer record or not active, redirect to home
    // (User should have been signed out after onboarding and will log in after approval)
    if (!detailer || !detailer.is_active) {
      return NextResponse.redirect(new URL('/', request.url));
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

  // Redirect authenticated users away from login page
  if (pathname.startsWith('/auth/login') && isAuthenticated) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    // Only redirect if we successfully got the profile
    // If there's an error, let the login page handle it (might be RLS issue)
    if (profile && !profileError) {
      if (profile.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else if (profile.role === 'detailer') {
        // Check onboarding and active status for detailers
        const { data: profileData } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user!.id)
          .single();

        if (!profileData?.onboarding_completed) {
          return NextResponse.redirect(new URL('/onboard', request.url));
        }

        const { data: detailer } = await supabase
          .from('detailers')
          .select('is_active')
          .eq('profile_id', user!.id)
          .single();

        // If detailer is not active, they need to wait for approval
        // Redirect to home page with a message (they'll be notified via email)
        if (!detailer || !detailer.is_active) {
          return NextResponse.redirect(new URL('/', request.url));
        }

        return NextResponse.redirect(new URL('/detailer/dashboard', request.url));
      }
    }
    // If profile query failed, don't redirect - let user stay on login page
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

