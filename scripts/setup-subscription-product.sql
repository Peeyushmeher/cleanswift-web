-- Set up the subscription product ID in platform_settings
-- This tells the system to use your existing Stripe product

-- First, set the product ID
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'subscription_product_id',
  'prod_TfgygGxpzaXmSE'::jsonb,
  'Stripe Product ID for detailer subscriptions',
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  value = 'prod_TfgygGxpzaXmSE'::jsonb,
  updated_at = NOW();

-- Check current subscription price setting
SELECT 
  key, 
  value,
  description
FROM platform_settings 
WHERE key IN ('subscription_product_id', 'subscription_price_id', 'subscription_monthly_price')
ORDER BY key;

