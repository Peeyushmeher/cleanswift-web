-- Quick Setup: Create Detailer Record for Testing
-- Run this in Supabase SQL Editor to quickly set up your admin account as a detailer for testing

-- Step 1: Create detailer record for your admin account
-- Replace 'your-admin-email@example.com' with your actual admin email

DO $$
DECLARE
  admin_profile_id uuid;
  admin_name text;
BEGIN
  -- Get your admin profile
  SELECT id, full_name INTO admin_profile_id, admin_name
  FROM profiles
  WHERE email = 'your-admin-email@example.com'  -- ⚠️ CHANGE THIS TO YOUR ADMIN EMAIL
  LIMIT 1;

  IF admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Admin profile not found. Update the email in this script.';
  END IF;

  -- Create detailer record if it doesn't exist
  INSERT INTO detailers (
    profile_id,
    full_name,
    rating,
    review_count,
    years_experience,
    is_active
  )
  VALUES (
    admin_profile_id,
    COALESCE(admin_name, 'Test Admin Detailer'),
    4.5,  -- Initial rating
    10,   -- Initial review count
    5,    -- Years of experience
    true  -- Active
  )
  ON CONFLICT (profile_id) DO NOTHING;

  RAISE NOTICE 'Detailer record created for admin: %', admin_name;
END $$;

-- Step 2: Create a test booking assigned to your detailer (optional, for testing the dashboard)
-- Uncomment and adjust the IDs below to create test data:

/*
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
  (SELECT id FROM profiles WHERE role = 'user' LIMIT 1),
  (SELECT id FROM cars LIMIT 1),
  (SELECT id FROM services WHERE is_active = true LIMIT 1),
  (SELECT id FROM detailers WHERE profile_id = (SELECT id FROM profiles WHERE email = 'your-admin-email@example.com')),
  CURRENT_DATE + INTERVAL '1 day',
  '10:00:00'::time,
  '123 Test Street',
  'Toronto',
  'ON',
  'M5H 2N2',
  'accepted'::booking_status_enum,
  149.00,
  0.00,
  19.37,
  168.37,
  'paid'::payment_status_enum
WHERE EXISTS (
  SELECT 1 FROM detailers 
  WHERE profile_id = (SELECT id FROM profiles WHERE email = 'your-admin-email@example.com')
);
*/

-- Verify the detailer was created:
SELECT 
  d.id,
  d.full_name,
  d.rating,
  p.email,
  p.role
FROM detailers d
JOIN profiles p ON d.profile_id = p.id
WHERE p.email = 'your-admin-email@example.com';  -- ⚠️ CHANGE THIS TO YOUR ADMIN EMAIL

