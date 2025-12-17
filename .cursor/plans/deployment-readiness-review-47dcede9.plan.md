---
name: Deployment Readiness Review Plan
overview: ""
todos: []
---

# Deployment Readiness Review Plan

## Critical Issues Found

### 1. **Middleware File Naming Issue** (CRITICAL)

- **Problem**: `proxy.ts` contains Next.js middleware code with a `config` export, but Next.js requires middleware to be in a file named `middleware.ts` in the root directory.
- **Impact**: Authentication and route protection will not work in production.
- **Location**: `proxy.ts` (root directory)
- **Fix Required**: Rename `proxy.ts` to `middleware.ts` and export the middleware function as `middleware` (not `proxy`).

### 2. **CORS Configuration** (SECURITY)

- **Problem**: Supabase Edge Functions use wildcard CORS (`Access-Control-Allow-Origin: *`).
- **Impact**: Security risk in production - allows any origin to call the functions.
- **Locations**: 
- `supabase/functions/create-detailer-subscription/index.ts`
- `supabase/functions/create-payment-intent/index.ts`
- `supabase/functions/process-refund/index.ts`
- `supabase/functions/mark-test-payment/index.ts`
- **Fix Required**: Restrict CORS to specific allowed origins for the acceptance domain.

## Required Environment Variables

### Next.js Application

- `NEXT_PUBLIC_SUPABASE_URL` - Required
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Required
- `SUPABASE_SERVICE_ROLE_KEY` - Required (server-side only, not exposed to client)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Optional (for maps functionality)

### Supabase Edge Functions

- `STRIPE_SECRET_KEY` - Required
- `STRIPE_WEBHOOK_SECRET` - Required (for webhook validation)
- `STRIPE_SUBSCRIPTION_PRICE_ID` - Required (for subscription pricing)
- `SUPABASE_URL` - Required
- `SUPABASE_SERVICE_ROLE_KEY` - Required
- `SUPABASE_ANON_KEY` - Required
- `ENABLE_TEST_PAYMENTS` - Optional (should be `false` in production)
- `TEST_PAYMENT_SECRET` - Optional (only if test payments enabled)

## Configuration Checklist

### ✅ Good Practices Found

- Environment variables properly used (no hardcoded values)
- No localhost URLs in production code
- `.env*` files properly gitignored
- TypeScript configuration looks correct
- Build scripts are standard Next.js

### ⚠️ Items to Verify

1. **Database Migrations**: Ensure all migrations in `supabase/migrations/` are applied to the acceptance database
2. **Supabase Edge Functions**: Deploy all functions to Supabase project
3. **Stripe Webhook Configuration**: Configure webhook endpoint in Stripe dashboard pointing to Supabase Edge Function
4. **Google Maps API**: Verify API key has correct domain restrictions
5. **Build Process**: Test `npm run build` succeeds without errors
6. **Environment Variables**: All required env vars must be set in deployment platform

## Potential Deployment Issues

### 1. **Middleware Not Executing**

- If `proxy.ts` is not renamed to `middleware.ts`, route protection will fail
- Users may be able to access protected routes without authentication

### 2. **Missing Environment Variables**

- Application will fail to start if required env vars are missing
- Edge functions will return 500 errors if env vars not configured in Supabase

### 3. **CORS Errors**

- If CORS is too restrictive or too permissive, API calls may fail
- Edge functions with wildcard CORS may be blocked by browser security policies

### 4. **Database Connection**

- Verify Supabase project URL and keys are correct for acceptance environment
- Ensure RLS policies are properly configured

### 5. **Stripe Configuration**

- Verify Stripe keys are for correct environment (test vs production)
- Webhook endpoint must be correctly configured in Stripe dashboard

## Files to Review/Update

1. **`proxy.ts`** → Should be `middleware.ts` with `middleware` export
2. **`next.config.ts`** → Verify no additional config needed for production
3. **Environment variable documentation** → Create `.env.example` if missing
4. **Supabase Edge Functions** → Update CORS headers to restrict origins

## Testing Recommendations

1. Run `npm run build` locally to verify build succeeds
2. Test authentication flow end-to-end
3. Verify API routes work correctly
4. Test Supabase Edge Functions with proper authentication
5. Verify Stripe webhook integration
6. Test Google Maps integration (if used)
7. Verify all protected routes require authentication