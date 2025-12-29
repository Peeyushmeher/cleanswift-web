# Fix: Can't Login on Localhost but Works on Hosted Version

## Problem
Login works on the hosted version but fails on localhost. This is almost always due to Supabase redirect URL configuration.

## Solution

### Step 1: Configure Supabase Redirect URLs

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `YOUR_PROJECT_REF`
3. Navigate to **Authentication** → **URL Configuration**
4. In the **Redirect URLs** section, add:
   ```
   http://localhost:3000/**
   http://localhost:3000/auth/callback
   http://127.0.0.1:3000/**
   http://127.0.0.1:3000/auth/callback
   ```
5. Click **Save**

### Step 2: Verify Site URL

In the same **URL Configuration** page:
- **Site URL** should be set to your production URL (e.g., `https://cleanswift.app`)
- This is fine - Supabase will use the redirect URLs for localhost

### Step 3: Restart Development Server

After making changes in Supabase:
```bash
# Stop your dev server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 4: Clear Browser Cache/Cookies

Sometimes old cookies can cause issues:
1. Open your browser's Developer Tools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Clear cookies for `localhost:3000`
4. Try logging in again

## Common Error Messages

### "Invalid login credentials"
- Usually means the redirect URL isn't configured
- Fix: Add localhost URLs to Supabase redirect URLs (Step 1)

### "Email not confirmed"
- Check your email for confirmation link
- If using localhost, the confirmation link might redirect to production
- Fix: Configure redirect URLs (Step 1)

### "Redirect URL not allowed"
- Supabase is blocking the redirect
- Fix: Add the exact URL to redirect URLs list

## Verification

After fixing, you should be able to:
1. ✅ Login at `http://localhost:3000/auth/login`
2. ✅ Be redirected to dashboard after login
3. ✅ See your user session persist

## Additional Troubleshooting

If login still doesn't work:

1. **Check Browser Console** (F12 → Console tab)
   - Look for any error messages
   - Check Network tab for failed requests

2. **Verify Environment Variables**
   ```bash
   # Make sure these are set in .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
   ```

3. **Check Supabase Project**
   - Make sure you're using the same Supabase project for localhost and production
   - Verify the project URL matches your `.env.local`

4. **Test with Different Browser**
   - Sometimes browser extensions can interfere
   - Try incognito/private mode

## Quick Checklist

- [ ] Added `http://localhost:3000/**` to Supabase redirect URLs
- [ ] Added `http://localhost:3000/auth/callback` to Supabase redirect URLs
- [ ] Restarted development server
- [ ] Cleared browser cookies for localhost
- [ ] Verified environment variables are correct
- [ ] Checked browser console for errors

