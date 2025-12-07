# Simple Step-by-Step Deployment Guide
**For steps 5.2 onwards**

---

## ✅ **GOOD NEWS: Edge Functions Are Already Deployed!**

I checked your Supabase project and these Edge Functions are already deployed:
- ✅ `create-payment-intent`
- ✅ `handle-stripe-webhook`
- ✅ `create-detailer-subscription`
- ✅ `process-refund`
- ✅ `create-stripe-connect-account`
- ✅ `mark-test-payment`

**You can SKIP Step 6.1** - the functions are already there!

---

## 📋 **WHAT YOU NEED TO DO NOW**

### **STEP 1: Get Your Vercel URL** (2 minutes)

1. Go to your **Vercel Dashboard**: https://vercel.com/dashboard
2. Click on your project
3. Look at the top - you'll see your deployment URL like:
   ```
   https://cleanswift-web-xxxxx.vercel.app
   ```
4. **Copy this URL** - you'll need it in the next steps

---

### **STEP 2: Configure Supabase Edge Functions CORS** (5 minutes)

**Why:** This allows your Vercel app to call the Edge Functions.

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Click **Edge Functions** in the left sidebar
4. Click **Settings** (top right)
5. Scroll down to **Environment Variables**
6. Look for `ALLOWED_ORIGINS` - if it exists, click **Edit**, if not, click **Add new variable**
7. **Variable Name:** `ALLOWED_ORIGINS`
8. **Variable Value:** Paste your Vercel URL:
   ```
   https://cleanswift-web-xxxxx.vercel.app
   ```
   (Replace with your actual Vercel URL)
9. Click **Save**

**✅ Done!** This allows your Vercel app to call the Edge Functions.

---

### **STEP 3: Add Stripe Environment Variables to Supabase** (10 minutes)

**Why:** Edge Functions need Stripe keys to process payments.

1. Still in **Supabase Dashboard** → **Edge Functions** → **Settings**
2. Scroll to **Environment Variables**
3. Add these variables one by one:

#### **Variable 1: STRIPE_SECRET_KEY**
- **Name:** `STRIPE_SECRET_KEY`
- **Value:** Your Stripe secret key (starts with `sk_live_` or `sk_test_`)
- **Where to find:** Stripe Dashboard → Developers → API keys → Secret key

#### **Variable 2: STRIPE_WEBHOOK_SECRET**
- **Name:** `STRIPE_WEBHOOK_SECRET`
- **Value:** We'll get this in Step 4 (for now, leave it empty or use a placeholder)
- **Note:** You'll update this after setting up the webhook

#### **Variable 3: STRIPE_SUBSCRIPTION_PRICE_ID**
- **Name:** `STRIPE_SUBSCRIPTION_PRICE_ID`
- **Value:** Your Stripe subscription price ID (starts with `price_`)
- **Where to find:** Stripe Dashboard → Products → Your subscription product → Price ID
- **If you don't have one yet:** Create a product in Stripe first, then get the price ID

#### **Variable 4: SUPABASE_URL**
- **Name:** `SUPABASE_URL`
- **Value:** Your Supabase project URL (you already have this)
- **Where to find:** Supabase Dashboard → Settings → API → Project URL

#### **Variable 5: SUPABASE_SERVICE_ROLE_KEY**
- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Your Supabase service role key (you already have this)
- **Where to find:** Supabase Dashboard → Settings → API → service_role key

#### **Variable 6: SUPABASE_ANON_KEY**
- **Name:** `SUPABASE_ANON_KEY`
- **Value:** Your Supabase anon key (you already have this)
- **Where to find:** Supabase Dashboard → Settings → API → anon public key

#### **Variable 7: ENABLE_TEST_PAYMENTS** (Optional)
- **Name:** `ENABLE_TEST_PAYMENTS`
- **Value:** `false` (for production)

**✅ Done!** Your Edge Functions can now process payments.

---

### **STEP 4: Set Up Stripe Webhook** (15 minutes)

**Why:** Stripe needs to tell your app when payments succeed/fail.

1. Go to **Stripe Dashboard**: https://dashboard.stripe.com
2. Click **Developers** in the left sidebar
3. Click **Webhooks**
4. Click **Add endpoint** (top right)

5. **Endpoint URL:** 
   ```
   https://nxxjpstkgbyaazmcybsf.supabase.co/functions/v1/handle-stripe-webhook
   ```
   (This is your Supabase project URL + the webhook function)

6. **Description:** `CleanSwift Payment Webhook` (optional)

7. **Events to send:** Click "Select events" and check these:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `charge.refunded`
   - ✅ `account.updated` (for Stripe Connect)

8. Click **Add endpoint**

9. **Copy the Signing Secret:**
   - After creating, click on the webhook you just created
   - You'll see a "Signing secret" section
   - Click **Reveal** and copy the secret (starts with `whsec_`)

10. **Add it to Supabase:**
    - Go back to **Supabase Dashboard** → **Edge Functions** → **Settings**
    - Find `STRIPE_WEBHOOK_SECRET` (or add it if you didn't before)
    - Paste the signing secret you just copied
    - Click **Save**

**✅ Done!** Stripe can now notify your app about payment events.

---

### **STEP 5: Test Your Deployment** (5 minutes)

1. **Visit your Vercel URL:**
   ```
   https://cleanswift-web-xxxxx.vercel.app
   ```
   (Use your actual URL)

2. **Test Login:**
   - Try logging in
   - Make sure it works

3. **Test a Payment Flow:**
   - Try creating a booking (if possible)
   - Or just verify the app loads without errors

4. **Check for Errors:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for any red errors
   - If you see CORS errors, go back to Step 2 and double-check `ALLOWED_ORIGINS`

---

## 🎯 **QUICK CHECKLIST**

- [ ] Got my Vercel URL
- [ ] Added `ALLOWED_ORIGINS` to Supabase Edge Functions (with my Vercel URL)
- [ ] Added `STRIPE_SECRET_KEY` to Supabase Edge Functions
- [ ] Added `STRIPE_SUBSCRIPTION_PRICE_ID` to Supabase Edge Functions
- [ ] Added `SUPABASE_URL` to Supabase Edge Functions
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` to Supabase Edge Functions
- [ ] Added `SUPABASE_ANON_KEY` to Supabase Edge Functions
- [ ] Created Stripe webhook endpoint
- [ ] Added `STRIPE_WEBHOOK_SECRET` to Supabase Edge Functions
- [ ] Tested my Vercel deployment

---

## ❓ **DO I NEED A CUSTOM DOMAIN? (Step 5.2)**

**Short answer: NO, not right now.**

- You can use the Vercel-provided URL (like `cleanswift-web-xxxxx.vercel.app`)
- Custom domains are optional
- You can add one later if you want

**If you DO want a custom domain:**
1. In Vercel, go to **Settings** → **Domains**
2. Add your domain (e.g., `app.yourdomain.com`)
3. Vercel will show you DNS records to add
4. Go to your domain registrar (where you bought the domain)
5. Add the DNS records Vercel tells you
6. Wait for DNS to propagate (can take up to 24 hours)

**For now, skip this and use the Vercel URL!**

---

## 🆘 **NEED HELP?**

**If you get stuck:**
1. Check the error message
2. Verify all environment variables are set correctly
3. Make sure your Vercel URL is in `ALLOWED_ORIGINS`
4. Check Supabase Edge Function logs for errors

**Common Issues:**
- **CORS errors:** Make sure `ALLOWED_ORIGINS` includes your exact Vercel URL
- **Payment fails:** Check that `STRIPE_SECRET_KEY` is correct
- **Webhook not working:** Verify the webhook URL and secret are correct

---

## ✅ **YOU'RE DONE WHEN:**

1. ✅ Your Vercel app loads without errors
2. ✅ You can log in
3. ✅ All environment variables are set in Supabase
4. ✅ Stripe webhook is created and secret is added

**That's it! Your app should be working now! 🎉**

