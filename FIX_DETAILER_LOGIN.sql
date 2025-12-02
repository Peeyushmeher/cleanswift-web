-- Fix Detailer Login: Check and Create User
-- Run this in Supabase SQL Editor

-- Step 1: Check if profile exists
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
WHERE email = 'detailer@test.com';

-- Step 2: If profile exists but user can't login, the auth user might not exist
-- You need to create the auth user via Supabase Dashboard:
-- 1. Go to Authentication → Users
-- 2. Click "Add User" → "Create new user"
-- 3. Email: detailer@test.com
-- 4. Password: TestDetailer123!
-- 5. Check "Auto Confirm User"
-- 6. Click "Create User"

-- Step 3: After creating auth user, update profile role
UPDATE profiles 
SET 
  role = 'detailer',
  full_name = COALESCE(full_name, 'Test Detailer')
WHERE email = 'detailer@test.com';

-- Step 4: Create detailer record
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
)
RETURNING *;

-- Step 5: Verify everything is set up
SELECT 
  p.id as profile_id,
  p.email,
  p.full_name,
  p.role,
  d.id as detailer_id,
  d.rating,
  d.is_active,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users WHERE auth.users.id = p.id
    ) THEN '✅ Auth user exists'
    ELSE '❌ Auth user missing - create via Dashboard'
  END as auth_status
FROM profiles p
LEFT JOIN detailers d ON d.profile_id = p.id
WHERE p.email = 'detailer@test.com';

