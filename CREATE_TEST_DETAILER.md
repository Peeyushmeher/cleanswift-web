# Create Test Detailer Account

## Quick Setup: Test Detailer Login

### Pre-Seeded QA Detailer (Already Created)

For convenience, a throwaway QA detailer account has already been created in Supabase. Use this when you just need to log in quickly without running any SQL:

- **Email:** `test-detailer@cleanswift.dev`
- **Password:** `TestDetailer123!`
- **Role:** `detailer`
- **Detailer ID:** Stored automatically (solo / no organization)

> This account is meant for local/demo testing only. You can always reset the password by running the SQL snippet in this file (Step 2) or via Supabase Auth → Users.

If you prefer to create your own detailer user, follow the steps below.

### Option 1: Create New Test Detailer Account (Recommended)

**Step 1: Create Auth User via Supabase Dashboard**

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter:
   - **Email:** `detailer@test.com`
   - **Password:** `TestDetailer123!` (or any password you prefer)
   - **Auto Confirm User:** ✅ (check this box)
4. Click "Create User"

**Step 2: Set Up Profile and Detailer Record**

Run this SQL in Supabase SQL Editor:

```sql
-- Step 1: Update profile role to 'detailer'
UPDATE profiles 
SET 
  role = 'detailer',
  full_name = 'Test Detailer'
WHERE email = 'detailer@test.com';

-- Step 2: Create detailer record
INSERT INTO detailers (
  profile_id,
  full_name,
  rating,
  review_count,
  years_experience,
  is_active
)
SELECT 
  id as profile_id,
  COALESCE(full_name, 'Test Detailer') as full_name,
  4.5 as rating,
  10 as review_count,
  5 as years_experience,
  true as is_active
FROM profiles 
WHERE email = 'detailer@test.com'
AND NOT EXISTS (
  SELECT 1 FROM detailers WHERE detailers.profile_id = profiles.id
);

-- Step 3: Verify it was created
SELECT 
  p.email,
  p.role,
  p.full_name,
  d.id as detailer_id,
  d.rating,
  d.is_active
FROM profiles p
LEFT JOIN detailers d ON d.profile_id = p.id
WHERE p.email = 'detailer@test.com';
```

**Step 3: Login Credentials**

- **Email:** `detailer@test.com`
- **Password:** `TestDetailer123!` (or whatever you set)

---

### Option 2: Use Existing User Account

If you already have a user account you want to convert to a detailer:

**Step 1: Find Your User**

```sql
-- List all users
SELECT id, email, full_name, role 
FROM profiles 
ORDER BY created_at DESC;
```

**Step 2: Convert to Detailer**

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET role = 'detailer'
WHERE email = 'your-email@example.com';

-- Create detailer record
INSERT INTO detailers (
  profile_id,
  full_name,
  rating,
  review_count,
  years_experience,
  is_active
)
SELECT 
  id as profile_id,
  COALESCE(full_name, 'Detailer') as full_name,
  4.5 as rating,
  10 as review_count,
  5 as years_experience,
  true as is_active
FROM profiles 
WHERE email = 'your-email@example.com'
AND NOT EXISTS (
  SELECT 1 FROM detailers WHERE detailers.profile_id = profiles.id
);
```

---

### Option 3: Create Multiple Test Detailers

```sql
-- Create detailer accounts for testing
-- Note: You'll need to create the auth users first via Supabase Dashboard

-- Detailer 1: High-rated detailer
UPDATE profiles SET role = 'detailer' WHERE email = 'detailer1@test.com';
INSERT INTO detailers (profile_id, full_name, rating, review_count, years_experience, is_active)
SELECT id, 'John Detailer', 4.8, 25, 7, true FROM profiles WHERE email = 'detailer1@test.com'
ON CONFLICT (profile_id) DO NOTHING;

-- Detailer 2: New detailer
UPDATE profiles SET role = 'detailer' WHERE email = 'detailer2@test.com';
INSERT INTO detailers (profile_id, full_name, rating, review_count, years_experience, is_active)
SELECT id, 'Jane Detailer', 4.2, 5, 1, true FROM profiles WHERE email = 'detailer2@test.com'
ON CONFLICT (profile_id) DO NOTHING;

-- Detailer 3: Experienced detailer
UPDATE profiles SET role = 'detailer' WHERE email = 'detailer3@test.com';
INSERT INTO detailers (profile_id, full_name, rating, review_count, years_experience, is_active)
SELECT id, 'Mike Detailer', 4.6, 50, 10, true FROM profiles WHERE email = 'detailer3@test.com'
ON CONFLICT (profile_id) DO NOTHING;
```

---

## Test Login Credentials Summary

### Default Test Detailer (if created via Option 1)

- **Email:** `detailer@test.com`
- **Password:** `TestDetailer123!` (or your chosen password)
- **Role:** `detailer`
- **Rating:** 4.5 ⭐
- **Reviews:** 10
- **Experience:** 5 years

---

## Verify Detailer Account

After creating the account, verify it works:

```sql
-- Check detailer record exists
SELECT 
  d.id,
  d.full_name,
  d.rating,
  d.review_count,
  d.years_experience,
  d.is_active,
  p.email,
  p.role
FROM detailers d
JOIN profiles p ON d.profile_id = p.id
WHERE p.email = 'detailer@test.com';
```

---

## Create Test Bookings for Detailer

To see data in the dashboard, create some test bookings:

```sql
-- Create a test booking assigned to your detailer
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
WHERE EXISTS (
  SELECT 1 FROM detailers 
  WHERE profile_id = (SELECT id FROM profiles WHERE email = 'detailer@test.com')
);
```

---

## Login to Dashboard

1. Navigate to: `http://localhost:3000/auth/login`
2. Enter your detailer credentials
3. You should be redirected to: `http://localhost:3000/detailer/dashboard`

---

## Troubleshooting

### "User profile not found" error
- Make sure you created the auth user first in Supabase Dashboard
- Verify the email matches exactly

### "Access denied" error
- Check that `role = 'detailer'` in profiles table
- Verify detailer record exists in detailers table

### Empty dashboard
- Create test bookings assigned to your detailer
- Check that bookings have `detailer_id` set correctly

