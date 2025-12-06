# Vercel Deployment Quick Checklist

## 🚀 **QUICK START (5 Minutes)**

### 1. Push to Git
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push
```

### 2. Deploy to Vercel
- Go to https://vercel.com/new
- Import your repository
- Click "Deploy" (will fail without env vars - that's OK)

### 3. Add Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

### 4. Redeploy
- Go to Deployments → Latest → "..." → Redeploy
- ✅ Should succeed now!

---

## 📋 **FULL CHECKLIST**

### Pre-Deployment
- [ ] Code committed and pushed to Git
- [ ] `npm run build` works locally
- [ ] Have Supabase credentials ready
- [ ] Have Stripe credentials ready (if using)

### Vercel Setup
- [ ] Created Vercel account
- [ ] Connected Git repository
- [ ] Project imported successfully
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (if using)
- [ ] Redeployed with environment variables
- [ ] Build successful

### Supabase Edge Functions
- [ ] Deployed `create-payment-intent`
- [ ] Deployed `create-detailer-subscription`
- [ ] Deployed `handle-stripe-webhook`
- [ ] Deployed `process-refund`
- [ ] Deployed `create-stripe-connect-account`
- [ ] Added `STRIPE_SECRET_KEY` to Edge Functions
- [ ] Added `STRIPE_WEBHOOK_SECRET` to Edge Functions
- [ ] Added `STRIPE_SUBSCRIPTION_PRICE_ID` to Edge Functions
- [ ] Added `SUPABASE_URL` to Edge Functions
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions
- [ ] Added `SUPABASE_ANON_KEY` to Edge Functions
- [ ] Added `ALLOWED_ORIGINS` to Edge Functions (with Vercel URL)

### Stripe Configuration
- [ ] Created webhook endpoint in Stripe Dashboard
- [ ] Webhook URL points to Supabase Edge Function
- [ ] Selected required webhook events
- [ ] Copied webhook signing secret
- [ ] Added webhook secret to Supabase Edge Functions

### Post-Deployment Testing
- [ ] Can access app at Vercel URL
- [ ] Login works
- [ ] Authentication redirects work
- [ ] Protected routes require login
- [ ] API routes respond correctly
- [ ] Stripe payments work (if applicable)
- [ ] Webhook receives events (check Stripe Dashboard)

### Optional
- [ ] Custom domain configured
- [ ] DNS records updated
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Analytics enabled
- [ ] Error tracking set up

---

## 🔑 **ENVIRONMENT VARIABLES REFERENCE**

### Vercel (Next.js App)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=xxx (optional)
```

### Supabase Edge Functions
```env
STRIPE_SECRET_KEY=sk_live_xxx (or sk_test_xxx)
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUBSCRIPTION_PRICE_ID=price_xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_ANON_KEY=eyJxxx...
ALLOWED_ORIGINS=https://your-app.vercel.app
ENABLE_TEST_PAYMENTS=false
```

---

## 🆘 **COMMON ISSUES**

| Issue | Solution |
|-------|----------|
| Build fails | Check environment variables are set |
| "Module not found" | Run `npm install` locally, check `package.json` |
| CORS errors | Set `ALLOWED_ORIGINS` in Supabase Edge Functions |
| Auth not working | Verify Supabase URL and keys are correct |
| Webhook not receiving | Check webhook URL and secret in Stripe |

---

**Need help?** See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed instructions.

