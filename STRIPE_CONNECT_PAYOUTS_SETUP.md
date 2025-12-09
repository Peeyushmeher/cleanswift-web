# Stripe Connect On-Demand Payouts Setup Guide

Complete step-by-step guide to deploy and configure the on-demand payout system for solo detailers.

---

## 📋 **PREREQUISITES**

Before starting, make sure you have:
- ✅ Supabase project access (Dashboard)
- ✅ Stripe account with API keys
- ✅ Supabase CLI installed (optional, but recommended)
- ✅ Database migrations already applied (✅ Done!)

---

## 🚀 **STEP 1: DEPLOY EDGE FUNCTIONS**

You need to deploy 3 new Edge Functions:
1. `process-detailer-transfer` - Processes individual transfers
2. `process-pending-transfers` - Scheduled job to process pending transfers
3. `retry-failed-transfers` - Retries failed transfers

### **Option A: Deploy via Supabase Dashboard** (Easiest)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/nxxjpstkgbyaazmcybsf/edge-functions

2. **Deploy `process-detailer-transfer`**
   - Click **"New Function"** or **"Deploy Function"**
   - Function name: `process-detailer-transfer`
   - Upload the folder: `supabase/functions/process-detailer-transfer/`
   - Click **"Deploy"**

3. **Deploy `process-pending-transfers`**
   - Click **"New Function"** or **"Deploy Function"**
   - Function name: `process-pending-transfers`
   - Upload the folder: `supabase/functions/process-pending-transfers/`
   - Click **"Deploy"**

4. **Deploy `retry-failed-transfers`**
   - Click **"New Function"** or **"Deploy Function"**
   - Function name: `retry-failed-transfers`
   - Upload the folder: `supabase/functions/retry-failed-transfers/`
   - Click **"Deploy"**

### **Option B: Deploy via Supabase CLI** (Recommended for automation)

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref nxxjpstkgbyaazmcybsf

# Deploy the new functions
supabase functions deploy process-detailer-transfer
supabase functions deploy process-pending-transfers
supabase functions deploy retry-failed-transfers
```

**✅ Verification:** After deployment, you should see all 3 functions in the Edge Functions list.

---

## ⚙️ **STEP 2: CONFIGURE EDGE FUNCTION ENVIRONMENT VARIABLES**

All Edge Functions need these environment variables. Configure them in:
**Supabase Dashboard → Edge Functions → Settings → Environment Variables**

### **Required Variables:**

```env
# Supabase Configuration
SUPABASE_URL=https://nxxjpstkgbyaazmcybsf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe webhook)

# CORS (if needed)
ALLOWED_ORIGINS=https://your-app.vercel.app,https://cleanswift.app
```

### **How to Get These Values:**

1. **SUPABASE_URL**: `https://nxxjpstkgbyaazmcybsf.supabase.co` (already known)
2. **SUPABASE_SERVICE_ROLE_KEY**: 
   - Go to: **Settings → API → service_role key** (secret)
   - Copy the key (starts with `eyJ...`)
3. **SUPABASE_ANON_KEY**:
   - Go to: **Settings → API → anon public key**
   - Copy the key (starts with `eyJ...`)
4. **STRIPE_SECRET_KEY**:
   - Go to: **Stripe Dashboard → Developers → API keys**
   - Copy **Secret key** (starts with `sk_live_` or `sk_test_`)
5. **STRIPE_WEBHOOK_SECRET**:
   - We'll get this in Step 3 after creating the webhook

**✅ Action:** Add all variables above (except STRIPE_WEBHOOK_SECRET for now) to Edge Functions settings.

---

## 🔄 **STEP 3: SET UP SCHEDULED JOBS (pg_cron)**

We need to set up 2 scheduled jobs:
1. **Process pending transfers** - Every 5 minutes
2. **Retry failed transfers** - Every 15 minutes

### **3.1 Enable pg_cron Extension**

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### **3.2 Create Scheduled Job for Processing Pending Transfers**

Run this SQL:

```sql
-- Schedule job to process pending transfers every 5 minutes
SELECT cron.schedule(
  'process-pending-transfers',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://nxxjpstkgbyaazmcybsf.supabase.co/functions/v1/process-pending-transfers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGpwc3RrZ2J5YWF6bWN5YnNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI5NzY2OCwiZXhwIjoyMDc4ODczNjY4fQ.q9_N7IQB84m9FdxHW6DNMOwiPDZ9M9miybN5qwPopNQ'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**⚠️ IMPORTANT:** Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key!

### **3.3 Create Scheduled Job for Retrying Failed Transfers**

Run this SQL:

```sql
-- Schedule job to retry failed transfers every 15 minutes
SELECT cron.schedule(
  'retry-failed-transfers',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://nxxjpstkgbyaazmcybsf.supabase.co/functions/v1/retry-failed-transfers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGpwc3RrZ2J5YWF6bWN5YnNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI5NzY2OCwiZXhwIjoyMDc4ODczNjY4fQ.q9_N7IQB84m9FdxHW6DNMOwiPDZ9M9miybN5qwPopNQ'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**⚠️ IMPORTANT:** Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key!

### **3.4 Verify Scheduled Jobs**

Check that jobs were created:

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;
```

You should see 2 jobs:
- `process-pending-transfers` (runs every 5 minutes)
- `retry-failed-transfers` (runs every 15 minutes)

### **3.5 Enable pg_net Extension (Required for HTTP calls)**

```sql
-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
```

**✅ Verification:** Both jobs should appear in `cron.job` table.

---

## 🔗 **STEP 4: CONFIGURE STRIPE WEBHOOK**

The webhook handler (`handle-stripe-webhook`) needs to receive transfer events from Stripe.

### **4.1 Update Existing Webhook Endpoint**

1. **Go to Stripe Dashboard**
   - Navigate to: **Developers → Webhooks**
   - Find your existing webhook endpoint (should be pointing to `handle-stripe-webhook`)

2. **Add Transfer Events**
   - Click on your webhook endpoint
   - Click **"Add events"** or **"Edit"**
   - In the search bar, type **"transfer"** to filter events
   - Scroll through the list and check these events:
     - ✅ `transfer.created` - "Occurs whenever a transfer is created"
     - ✅ `transfer.paid` - "Occurs whenever a transfer is paid" (this is the correct event, NOT `transfer.succeeded`)
     - ✅ `transfer.failed` - "Occurs whenever a transfer fails"
   - **Note:** If you don't see `transfer.paid` or `transfer.failed`, try:
     - Scrolling down in the filtered list
     - Clearing the search and searching again
     - Looking in the "Transfers" section of events
   - Click **"Save"** or **"Save destination"**

### **4.2 Create New Webhook (If You Don't Have One)**

If you don't have a webhook yet:

1. **Go to Stripe Dashboard → Developers → Webhooks**
2. **Click "Add endpoint"**
3. **Endpoint URL:**
   ```
   https://nxxjpstkgbyaazmcybsf.supabase.co/functions/v1/handle-stripe-webhook
   ```
4. **Events to send:** Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - **Transfer Events (search for "transfer"):**
     - ✅ `transfer.created` ⭐ NEW - "Occurs whenever a transfer is created"
     - ✅ `transfer.paid` ⭐ NEW - "Occurs whenever a transfer is paid" (NOT `transfer.succeeded`)
     - ✅ `transfer.failed` ⭐ NEW - "Occurs whenever a transfer fails"
5. **Click "Add endpoint"**

### **4.3 Get Webhook Signing Secrets**

Since you have **two separate webhook endpoints** (one for regular payments, one for Stripe Connect transfers), you need to get **both signing secrets**:

#### **For Regular Payment Events Endpoint:**
1. Click on the webhook endpoint that has your regular payment events (the one with 9 events)
2. Find **"Signing secret"** section
3. Click **"Reveal"** and copy the secret (starts with `whsec_`)
4. **Add to Supabase Edge Functions environment variables:**
   - Variable name: `STRIPE_WEBHOOK_SECRET`
   - Variable value: `whsec_...` (paste the secret)

#### **For Stripe Connect Transfer Events Endpoint:**
1. Click on the webhook endpoint that has transfer events (the one with 3 events)
2. Find **"Signing secret"** section
3. Click **"Reveal"** and copy the secret (starts with `whsec_`)
4. **Add to Supabase Edge Functions environment variables:**
   - Variable name: `STRIPE_CONNECT_WEBHOOK_SECRET`
   - Variable value: `whsec_...` (paste the secret)

**✅ Important:** The webhook handler has been updated to automatically try both secrets, so it will work with either endpoint.

**✅ Verification:** Both webhooks should show as "Active" in Stripe Dashboard.

---

## 🧪 **STEP 5: TEST THE SYSTEM**

### **5.1 Test Setup: Create a Test Detailer with Stripe Connect**

1. **Create a test detailer** (if you don't have one)
2. **Set up Stripe Connect account** for the detailer:
   - Use the `create-stripe-connect-account` Edge Function
   - Or manually create in Stripe Dashboard
3. **Link the account** to the detailer:
   ```sql
   UPDATE detailers 
   SET stripe_connect_account_id = 'acct_...' 
   WHERE id = 'your-detailer-id';
   ```

### **5.2 Test: Complete a Booking**

1. **Create a test booking** assigned to the detailer
2. **Mark booking as completed:**
   ```sql
   -- This should automatically create a transfer record
   SELECT update_booking_status('booking-id-here', 'completed');
   ```

3. **Verify transfer record was created:**
   ```sql
   SELECT * FROM detailer_transfers 
   WHERE booking_id = 'booking-id-here';
   ```
   - Should show status = `'pending'`

### **5.3 Test: Process Pending Transfer**

**Option A: Wait for scheduled job (5 minutes)**
- Wait 5 minutes for the cron job to run
- Check if transfer was processed

**Option B: Manually trigger (for testing)**
```bash
# Call the Edge Function directly
curl -X POST \
  'https://nxxjpstkgbyaazmcybsf.supabase.co/functions/v1/process-pending-transfers' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### **5.4 Verify Transfer Status**

Check the transfer status:
```sql
SELECT 
  id,
  booking_id,
  detailer_id,
  amount_cents,
  status,
  stripe_transfer_id,
  error_message,
  created_at
FROM detailer_transfers
WHERE booking_id = 'your-booking-id';
```

**Expected flow:**
1. `status = 'pending'` → Transfer record created
2. `status = 'processing'` → Transfer submitted to Stripe
3. `status = 'succeeded'` → Transfer completed (via webhook)
4. `stripe_transfer_id` → Should have a Stripe transfer ID

### **5.5 Check Edge Function Logs**

1. **Go to Supabase Dashboard → Edge Functions**
2. **Click on `process-detailer-transfer`**
3. **View Logs** tab
4. Check for any errors or success messages

### **5.6 Check Stripe Dashboard**

1. **Go to Stripe Dashboard → Transfers**
2. You should see the transfer to the connected account
3. Verify the amount matches the calculated payout

---

## 🔍 **TROUBLESHOOTING**

### **Issue: Transfer not being created**

**Check:**
- Is the detailer solo (not in an organization)?
- Does the detailer have `stripe_connect_account_id` set?
- Is the booking status actually 'completed'?

**Debug:**
```sql
-- Check detailer info
SELECT id, organization_id, stripe_connect_account_id 
FROM detailers 
WHERE id = 'detailer-id';

-- Check booking status
SELECT id, status, detailer_id, total_amount 
FROM bookings 
WHERE id = 'booking-id';
```

### **Issue: Scheduled job not running**

**Check:**
- Is `pg_cron` extension enabled?
- Is `pg_net` extension enabled?
- Is the service role key correct in the cron job?

**Debug:**
```sql
-- Check cron jobs
SELECT * FROM cron.job;

-- Check cron job history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### **Issue: Edge Function returns 401/403**

**Check:**
- Is the service role key correct in environment variables?
- Is the Authorization header correct in the cron job?

### **Issue: Can't find transfer events in Stripe webhook**

**If you don't see `transfer.paid` or `transfer.failed` events:**

1. **Search for "transfer"** in the events list
2. **Scroll down** - there are many transfer-related events
3. **Look for these specific events:**
   - `transfer.created` - Usually near the top when searching "transfer"
   - `transfer.paid` - Look for "Occurs whenever a transfer is paid"
   - `transfer.failed` - Look for "Occurs whenever a transfer fails"
4. **Alternative:** If you can't find `transfer.paid`, you can use `transfer.updated` as a fallback, but `transfer.paid` is the recommended event

**Note:** The event is called `transfer.paid`, NOT `transfer.succeeded`. There is no `transfer.succeeded` event in Stripe.

### **Issue: Stripe transfer fails**

**Check:**
- Is the Stripe Connect account fully activated?
- Does the account have sufficient funds?
- Check Stripe Dashboard → Transfers for error details

**Debug:**
```sql
-- Check transfer error message
SELECT error_message, retry_count, status 
FROM detailer_transfers 
WHERE status = 'failed';
```

---

## ✅ **VERIFICATION CHECKLIST**

Before going to production, verify:

- [ ] All 3 Edge Functions deployed (`process-detailer-transfer`, `process-pending-transfers`, `retry-failed-transfers`)
- [ ] All environment variables configured in Edge Functions settings
- [ ] `pg_cron` extension enabled
- [ ] `pg_net` extension enabled
- [ ] Scheduled jobs created and visible in `cron.job` table
- [ ] Stripe webhook configured with transfer events
- [ ] `STRIPE_WEBHOOK_SECRET` added to Edge Functions
- [ ] Test transfer created successfully
- [ ] Test transfer processed successfully
- [ ] Transfer appears in Stripe Dashboard
- [ ] Webhook events received and processed

---

## 📚 **ADDITIONAL RESOURCES**

- **Supabase Edge Functions Docs:** https://supabase.com/docs/guides/functions
- **Stripe Connect Docs:** https://stripe.com/docs/connect
- **pg_cron Docs:** https://github.com/citusdata/pg_cron
- **Stripe Webhooks:** https://stripe.com/docs/webhooks

---

## 🎉 **YOU'RE DONE!**

Once all steps are complete, your system will:
1. ✅ Automatically create transfer records when bookings are completed
2. ✅ Process transfers every 5 minutes via scheduled job
3. ✅ Retry failed transfers every 15 minutes
4. ✅ Update transfer status via Stripe webhooks
5. ✅ Display transfer history to detailers in the earnings page

**Happy coding! 🚀**

