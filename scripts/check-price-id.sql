-- Check where the invalid price ID is stored
-- Run this in Supabase SQL Editor

-- Check database
SELECT 
  key, 
  value::text as value,
  description,
  updated_at
FROM platform_settings 
WHERE key = 'subscription_price_id';

-- Check if product ID is set
SELECT 
  key, 
  value::text as value,
  description
FROM platform_settings 
WHERE key = 'subscription_product_id';

