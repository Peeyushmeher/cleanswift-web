-- Create Profile for Detailer User
-- Run this in Supabase SQL Editor after creating the auth user

-- Step 1: Get the auth user ID
-- First, let's check if the auth user exists
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'detailer@test.com';

-- Step 2: Create the profile record
-- Replace the UUID below with the actual auth user ID from Step 1
-- OR use this dynamic version:

DO $$
DECLARE
  auth_user_id uuid;
  auth_user_email text;
BEGIN
  -- Get the auth user
  SELECT id, email INTO auth_user_id, auth_user_email
  FROM auth.users
  WHERE email = 'detailer@test.com'
  LIMIT 1;

  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user not found. Create the user in Supabase Dashboard first.';
  END IF;

  -- Create profile if it doesn't exist
  INSERT INTO profiles (
    id,
    email,
    full_name,
    phone,
    role
  )
  VALUES (
    auth_user_id,
    auth_user_email,
    'Test Detailer',
    '',
    'detailer'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'detailer',
    full_name = COALESCE(profiles.full_name, 'Test Detailer');

  RAISE NOTICE 'Profile created/updated for: %', auth_user_email;
END $$;

-- Step 3: Create detailer record
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
ON CONFLICT (profile_id) DO UPDATE
SET 
  is_active = true,
  full_name = COALESCE(EXCLUDED.full_name, detailers.full_name);

-- Step 4: Verify everything is set up correctly
SELECT 
  au.id as auth_user_id,
  au.email as auth_email,
  au.email_confirmed_at,
  p.id as profile_id,
  p.full_name,
  p.role,
  d.id as detailer_id,
  d.rating,
  d.is_active,
  CASE 
    WHEN au.id IS NOT NULL AND p.id IS NOT NULL AND d.id IS NOT NULL 
    THEN '✅ All set up correctly!'
    ELSE '❌ Something is missing'
  END as status
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
LEFT JOIN detailers d ON d.profile_id = p.id
WHERE au.email = 'detailer@test.com';

