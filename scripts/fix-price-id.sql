-- Fix: Clear invalid price ID and set product ID correctly
-- Run this in Supabase SQL Editor

-- Clear the invalid price ID (set to JSON null)
UPDATE platform_settings 
SET 
  value = 'null'::jsonb,
  updated_at = NOW()
WHERE key = 'subscription_price_id';

-- Set your product ID (wrapped in JSON string quotes)
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

-- Verify the changes
SELECT 
  key, 
  value::text as value,
  description,
  updated_at
FROM platform_settings 
WHERE key IN ('subscription_product_id', 'subscription_price_id')
ORDER BY key;

