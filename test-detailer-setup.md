# Testing Detailer Dashboard - Quick Setup

## Option 1: Navigate Directly (Easiest)

Since you're logged in as admin, you can directly access the detailer dashboard:

**Just navigate to:** `http://localhost:3000/detailer/dashboard`

The middleware allows admins to access detailer routes, so this should work immediately.

## Option 2: Create or Use a Test Detailer Account

### Pre-Seeded QA Detailer

Already set up for local testing:

- **Email:** `test-detailer@cleanswift.dev`
- **Password:** `TestDetailer123!`

Use this account whenever you just need a throwaway detailer user. You can reset the password in Supabase Auth if needed.

### Create Your Own Detailer

If you want to test with a detailer account:

### Step 1: Create a Detailer User

```sql
-- In Supabase SQL Editor, run this to create a test detailer:

-- 1. Create auth user (you'll need to do this via Supabase Auth UI or use supabase.auth.admin.createUser)
-- OR just sign up a new user via the app

-- 2. After user exists, set their profile role to 'detailer':
UPDATE profiles 
SET role = 'detailer' 
WHERE email = 'detailer@test.com';  -- Replace with your test email

-- 3. Create a detailer record linked to the profile:
INSERT INTO detailers (profile_id, full_name, rating, review_count, years_experience, is_active)
SELECT 
  id as profile_id,
  full_name,
  4.5 as rating,
  10 as review_count,
  5 as years_experience,
  true as is_active
FROM profiles 
WHERE email = 'detailer@test.com'  -- Replace with your test email
AND NOT EXISTS (
  SELECT 1 FROM detailers WHERE detailers.profile_id = profiles.id
);
```

### Step 2: Create a Test Booking for the Detailer

```sql
-- Create a test booking assigned to your detailer:
-- First, get your detailer ID:
SELECT id FROM detailers WHERE profile_id = (
  SELECT id FROM profiles WHERE email = 'detailer@test.com'
);

-- Then create a booking (adjust IDs as needed):
INSERT INTO bookings (
  receipt_id,
  user_id,
  car_id,
  service_id,
  detailer_id,
  scheduled_date,
  scheduled_time_start,
  address_line1,
  city,
  province,
  postal_code,
  status,
  service_price,
  addons_total,
  tax_amount,
  total_amount,
  payment_status
)
SELECT 
  'TEST-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || upper(substring(md5(random()::text) from 1 for 4)),
  (SELECT id FROM profiles WHERE role = 'user' LIMIT 1) as user_id,
  (SELECT id FROM cars LIMIT 1) as car_id,
  (SELECT id FROM services WHERE is_active = true LIMIT 1) as service_id,
  (SELECT id FROM detailers WHERE profile_id = (SELECT id FROM profiles WHERE email = 'detailer@test.com')) as detailer_id,
  CURRENT_DATE + INTERVAL '1 day' as scheduled_date,
  '10:00:00'::time as scheduled_time_start,
  '123 Test Street' as address_line1,
  'Toronto' as city,
  'ON' as province,
  'M5H 2N2' as postal_code,
  'accepted'::booking_status_enum as status,
  149.00 as service_price,
  0.00 as addons_total,
  19.37 as tax_amount,
  168.37 as total_amount,
  'paid'::payment_status_enum as payment_status
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'detailer@test.com');
```

## Option 3: Update Existing Admin Account to Detailer (Quick Test)

If you want to quickly test with your current account:

```sql
-- Temporarily change your admin account to detailer role:
UPDATE profiles 
SET role = 'detailer' 
WHERE email = 'your-admin-email@example.com';  -- Replace with your admin email

-- Create detailer record:
INSERT INTO detailers (profile_id, full_name, rating, review_count, years_experience, is_active)
SELECT 
  id as profile_id,
  full_name,
  4.5 as rating,
  10 as review_count,
  5 as years_experience,
  true as is_active
FROM profiles 
WHERE email = 'your-admin-email@example.com'  -- Replace with your admin email
AND NOT EXISTS (
  SELECT 1 FROM detailers WHERE detailers.profile_id = profiles.id
);

-- Remember to change back to admin after testing:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';
```

## Quick Access URLs

Once you have a detailer account or access as admin:

- **Detailer Dashboard:** `http://localhost:3000/detailer/dashboard`
- **Jobs:** `http://localhost:3000/detailer/bookings`
- **Schedule:** `http://localhost:3000/detailer/schedule`
- **Earnings:** `http://localhost:3000/detailer/earnings`
- **Reviews:** `http://localhost:3000/detailer/reviews`
- **Settings:** `http://localhost:3000/detailer/settings`

## What You Should See

The Detailer Dashboard includes:
- ✅ Navigation sidebar (Home, Jobs, Schedule, Earnings, Reviews, Settings)
- ✅ Stats cards (Upcoming, In Progress, Completed, Total Earnings)
- ✅ Earnings chart
- ✅ Rating summary
- ✅ Today's jobs list
- ✅ Calendar view

This is different from the Admin Dashboard which shows "Recent Bookings" table.

