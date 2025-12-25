-- ============================================================================
-- Add Subscription Price Settings
-- ============================================================================
-- This migration adds subscription pricing settings to platform_settings table:
-- - subscription_monthly_price: The monthly subscription price amount (e.g., 29.99)
-- - subscription_price_id: The current Stripe Price ID for subscriptions
-- ============================================================================

-- Insert subscription monthly price setting if it doesn't exist
INSERT INTO platform_settings (key, value, description)
VALUES (
  'subscription_monthly_price',
  '29.99'::jsonb,
  'Monthly subscription price for detailers on subscription pricing model. Default: $29.99'
)
ON CONFLICT (key) DO NOTHING;

-- Insert subscription price ID setting if it doesn't exist
-- This will be null initially and populated when admin creates/updates subscription price
INSERT INTO platform_settings (key, value, description)
VALUES (
  'subscription_price_id',
  'null'::jsonb,
  'Current Stripe Price ID for detailer subscriptions. Falls back to STRIPE_SUBSCRIPTION_PRICE_ID env var if not set.'
)
ON CONFLICT (key) DO NOTHING;

-- Note: 'null'::jsonb stores the JSON null value, which is different from SQL NULL
-- This allows the code to distinguish between "not set" (env var fallback) and "explicitly null"

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The subscription_monthly_price and subscription_price_id settings have been added.
-- These can be retrieved and updated through the admin dashboard.
-- ============================================================================

