-- Clear the invalid price ID so system can create a new one
-- Run this in Supabase SQL Editor

-- Clear the invalid price ID
UPDATE platform_settings 
SET 
  value = 'null'::jsonb,
  updated_at = NOW()
WHERE key = 'subscription_price_id';

-- Verify it's cleared
SELECT 
  key, 
  value::text as value,
  updated_at
FROM platform_settings 
WHERE key = 'subscription_price_id';

-- Make sure product ID is set (if you have one)
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'subscription_product_id',
  '"prod_TfgygGxpzaXmSE"'::jsonb,
  'Stripe Product ID for detailer subscriptions',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  value = '"prod_TfgygGxpzaXmSE"'::jsonb,
  updated_at = NOW();

