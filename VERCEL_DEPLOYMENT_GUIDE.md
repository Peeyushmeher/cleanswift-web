# Complete Vercel Deployment Guide
**For CleanSwift Web Dashboard**

---

## 📋 **PREREQUISITES**

Before deploying, ensure you have:
- ✅ Vercel account (sign up at https://vercel.com)
- ✅ GitHub/GitLab/Bitbucket account (for repository connection)
- ✅ Your code pushed to a Git repository
- ✅ Supabase project set up and running
- ✅ Stripe account configured

---

## 🚀 **STEP 1: PREPARE YOUR REPOSITORY**

### 1.1 Push Code to Git
```bash
# If not already done, initialize and push to your repository
git init
git add .
git commit -m "Initial commit - ready for Vercel deployment"
git remote add origin <your-repo-url>
git push -u origin main
```

### 1.2 Verify Build Works Locally
```bash
npm run build
```
✅ If this succeeds, you're ready to deploy!

---

## 🔧 **STEP 2: VERCEL PROJECT SETUP**

### Option A: Deploy via Vercel Dashboard (Recommended for First Time)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click "Add New..." → "Project"

2. **Import Your Repository**
   - Connect your Git provider (GitHub/GitLab/Bitbucket)
   - Select your repository
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `.next` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)

4. **Environment Variables** (DO NOT SET YET - we'll do this in Step 3)
   - Click "Skip" for now, we'll add them after

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (will fail without env vars, that's OK)

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
cd /Users/camps/cleanswift-web
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? (select your account)
# - Link to existing project? N (first time)
# - Project name? cleanswift-web (or your choice)
# - Directory? ./
# - Override settings? N
```

---

## 🔐 **STEP 3: CONFIGURE ENVIRONMENT VARIABLES**

### 3.1 Required Environment Variables

Go to your Vercel project → **Settings** → **Environment Variables** and add:

#### **Required Variables:**

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Site URL (for email confirmation links)
NEXT_PUBLIC_SITE_URL=https://cleanswift.app
# Or use your Vercel URL: https://your-project.vercel.app

# Optional (if using Google Maps)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 3.2 Environment Variable Settings

For each variable:
- **Environment:** Select all (Production, Preview, Development)
- **Value:** Paste your actual value
- Click "Save"

**⚠️ IMPORTANT:**
- `NEXT_PUBLIC_*` variables are exposed to the browser - safe for public keys
- `SUPABASE_SERVICE_ROLE_KEY` is server-only - keep it secret!

### 3.3 Where to Find Your Values

**Supabase Credentials:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

**Google Maps API Key:**
1. Go to https://console.cloud.google.com
2. Create API key or use existing
3. Restrict to your Vercel domain

### 3.4 Configure Supabase Site URL (IMPORTANT for Email Confirmation)

**This is critical for email confirmation links to work correctly!**

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://cleanswift.app
   ```
   Or if using Vercel URL:
   ```
   https://your-project.vercel.app
   ```
3. Add **Redirect URLs** (if not already present):
   ```
   https://cleanswift.app/**
   https://your-project.vercel.app/**
   ```
4. Click **Save**

**⚠️ Why this matters:**
- Email confirmation links will redirect to this URL
- Without this, users clicking confirmation emails will be redirected to `localhost:3000`
- This must match your production domain

---

## 🔄 **STEP 4: REDEPLOY WITH ENVIRONMENT VARIABLES**

After adding environment variables:

1. **Via Dashboard:**
   - Go to **Deployments** tab
   - Click the "..." menu on latest deployment
   - Click "Redeploy"
   - ✅ Build should succeed now!

2. **Via CLI:**
   ```bash
   vercel --prod
   ```

---

## 🌐 **STEP 5: CONFIGURE CUSTOM DOMAIN (Optional)**

### 5.1 Add Domain in Vercel

1. Go to **Settings** → **Domains**
2. Enter your domain (e.g., `app.yourdomain.com`)
3. Click "Add"

### 5.2 Configure DNS

Vercel will show you DNS records to add:
- **Type:** CNAME or A record
- **Name:** `app` (or your subdomain)
- **Value:** Vercel-provided target

### 5.3 Update Supabase Edge Functions CORS

After you have your production domain:

1. Go to **Supabase Dashboard** → **Edge Functions** → **Settings**
2. Add environment variable:
   ```
   ALLOWED_ORIGINS=https://your-domain.vercel.app,https://app.yourdomain.com
   ```
3. Update all Edge Functions to use this (already configured in code)

---

## ⚙️ **STEP 6: SUPABASE EDGE FUNCTIONS DEPLOYMENT**

Your Edge Functions are deployed separately to Supabase (not Vercel).

### 6.1 Deploy Edge Functions

**Option A: Via Supabase Dashboard**
1. Go to **Supabase Dashboard** → **Edge Functions**
2. For each function, click "Deploy" and upload the function folder

**Option B: Via Supabase CLI** (Recommended)
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy create-payment-intent
supabase functions deploy create-detailer-subscription
supabase functions deploy handle-stripe-webhook
supabase functions deploy process-refund
supabase functions deploy create-stripe-connect-account
supabase functions deploy mark-test-payment
```

### 6.2 Configure Edge Function Environment Variables

In **Supabase Dashboard** → **Edge Functions** → **Settings**, add:

```env
# Required
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for staging)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUBSCRIPTION_PRICE_ID=price_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Recommended for Production
ALLOWED_ORIGINS=https://your-app.vercel.app,https://app.yourdomain.com

# Optional
ENABLE_TEST_PAYMENTS=false
```

### 6.3 Get Edge Function URLs

After deployment, note the URLs:
- `https://your-project.supabase.co/functions/v1/create-payment-intent`
- `https://your-project.supabase.co/functions/v1/create-detailer-subscription`
- `https://your-project.supabase.co/functions/v1/handle-stripe-webhook`
- `https://your-project.supabase.co/functions/v1/process-refund`
- `https://your-project.supabase.co/functions/v1/create-stripe-connect-account`

---

## 🔗 **STEP 7: CONFIGURE STRIPE WEBHOOK**

### 7.1 Create Webhook Endpoint in Stripe

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click "Add endpoint"
3. **Endpoint URL:** 
   ```
   https://your-project.supabase.co/functions/v1/handle-stripe-webhook
   ```
4. **Events to send:** Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `account.updated` (for Stripe Connect)

5. Click "Add endpoint"

### 7.2 Get Webhook Signing Secret

1. After creating webhook, click on it
2. Copy the **Signing secret** (starts with `whsec_`)
3. Add to Supabase Edge Functions environment variables as `STRIPE_WEBHOOK_SECRET`

---

## ✅ **STEP 8: POST-DEPLOYMENT VERIFICATION**

### 8.1 Test Your Deployment

1. **Visit your Vercel URL:**
   ```
   https://your-project.vercel.app
   ```

2. **Test Authentication:**
   - Try logging in
   - Verify redirects work
   - Check middleware protection

3. **Test API Routes:**
   - Try creating a booking
   - Test Stripe Connect flow
   - Verify webhook receives events

### 8.2 Check Build Logs

1. Go to **Deployments** tab
2. Click on latest deployment
3. Check **Build Logs** for any errors

### 8.3 Monitor Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Check for any errors in function execution

---

## 🛠️ **STEP 9: VERCEL-SPECIFIC CONFIGURATIONS**

### 9.1 Create `vercel.json` (Optional)

Create this file in your project root if you need custom settings:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

**Note:** You don't need this if using the dashboard - it's auto-detected.

### 9.2 Configure Build Settings

In **Settings** → **General**:
- **Node.js Version:** 20.x (recommended)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

### 9.3 Enable Preview Deployments

Preview deployments are enabled by default:
- Every push to a branch creates a preview
- Pull requests get preview URLs
- Great for testing before merging!

---

## 🔍 **TROUBLESHOOTING**

### Build Fails

**Error: Missing environment variables**
- ✅ Solution: Add all required env vars in Vercel dashboard

**Error: Module not found**
- ✅ Solution: Ensure `package.json` has all dependencies
- Run `npm install` locally to verify

**Error: TypeScript errors**
- ✅ Solution: Fix TypeScript errors locally first
- Run `npm run build` locally to catch errors

### Runtime Errors

**Error: Supabase connection failed**
- ✅ Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- ✅ Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- ✅ Verify Supabase project is active

**Error: Stripe payment fails**
- ✅ Check Edge Functions are deployed
- ✅ Verify `STRIPE_SECRET_KEY` in Supabase Edge Functions
- ✅ Check webhook is configured correctly

**Error: CORS errors**
- ✅ Set `ALLOWED_ORIGINS` in Supabase Edge Functions
- ✅ Include your Vercel domain in the list

### Authentication Issues

**Email confirmation redirects to localhost:3000**
- ✅ **Solution:** Configure Supabase Site URL (see Step 3.4)
  1. Go to Supabase Dashboard → Authentication → URL Configuration
  2. Set Site URL to `https://cleanswift.app` (or your production domain)
  3. Add redirect URLs: `https://cleanswift.app/**`
  4. Also set `NEXT_PUBLIC_SITE_URL` environment variable in Vercel
  5. Redeploy your application

**Redirects not working**
- ✅ Check middleware is deployed correctly
- ✅ Verify cookies are set (check browser DevTools)

**Session not persisting**
- ✅ Check cookie settings in middleware
- ✅ Verify Supabase auth configuration

---

## 📊 **MONITORING & ANALYTICS**

### Vercel Analytics (Optional)

1. Go to **Settings** → **Analytics**
2. Enable Vercel Analytics (free tier available)
3. Monitor:
   - Page views
   - Performance metrics
   - Error rates

### Error Tracking

Consider adding:
- **Sentry** for error tracking
- **LogRocket** for session replay
- **Vercel Logs** (built-in)

---

## 🔄 **CONTINUOUS DEPLOYMENT**

Vercel automatically:
- ✅ Deploys on every push to `main` (production)
- ✅ Creates previews for other branches
- ✅ Shows deployment status in GitHub PRs

### Manual Deployment

```bash
# Deploy to production
vercel --prod

# Deploy preview
vercel
```

---

## 📝 **QUICK REFERENCE CHECKLIST**

### Pre-Deployment
- [ ] Code pushed to Git repository
- [ ] `npm run build` succeeds locally
- [ ] All environment variables documented

### Vercel Setup
- [ ] Vercel account created
- [ ] Project imported from Git
- [ ] Environment variables added
- [ ] Initial deployment successful

### Supabase
- [ ] Edge Functions deployed
- [ ] Edge Function environment variables set
- [ ] `ALLOWED_ORIGINS` configured

### Stripe
- [ ] Webhook endpoint created
- [ ] Webhook secret added to Supabase
- [ ] Production Stripe keys configured

### Post-Deployment
- [ ] Custom domain configured (if applicable)
- [ ] Authentication tested
- [ ] Payment flow tested
- [ ] Webhook receiving events
- [ ] Monitoring set up

---

## 🆘 **GETTING HELP**

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Vercel Support:** support@vercel.com

---

## 🎉 **YOU'RE READY!**

Once all steps are complete, your app will be live at:
```
https://your-project.vercel.app
```

**Next Steps:**
1. Test all critical user flows
2. Monitor error logs for first 24 hours
3. Set up alerts for production issues
4. Configure custom domain (if needed)
5. Enable analytics and monitoring

---

**Good luck with your deployment! 🚀**

