-- ============================================================================
-- Add Pricing Model Columns to Detailers Table
-- ============================================================================
-- This migration adds columns to support hybrid pricing model:
-- - pricing_model: 'subscription' or 'percentage'
-- - stripe_subscription_id: Track active Stripe subscriptions
-- - stripe_customer_id: Track Stripe customer for subscription billing
-- ============================================================================

-- Add pricing_model column (nullable, defaults to NULL for existing detailers)
ALTER TABLE detailers 
ADD COLUMN IF NOT EXISTS pricing_model text 
CHECK (pricing_model IS NULL OR pricing_model IN ('subscription', 'percentage'));

COMMENT ON COLUMN detailers.pricing_model IS 
'Pricing model for this detailer: "subscription" for monthly subscription, "percentage" for pay-per-booking. NULL defaults to percentage behavior.';

-- Add stripe_subscription_id column (nullable)
ALTER TABLE detailers 
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

COMMENT ON COLUMN detailers.stripe_subscription_id IS 
'Stripe subscription ID for detailers on subscription pricing model. NULL if not on subscription or subscription not yet created.';

-- Add stripe_customer_id column (nullable)
-- Note: profiles table already has stripe_customer_id, but we may need it on detailers for subscription management
ALTER TABLE detailers 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

COMMENT ON COLUMN detailers.stripe_customer_id IS 
'Stripe customer ID for subscription billing. May be different from profiles.stripe_customer_id if detailer uses different payment method.';

-- Create index for pricing_model queries
CREATE INDEX IF NOT EXISTS idx_detailers_pricing_model 
ON detailers(pricing_model) 
WHERE pricing_model IS NOT NULL;

-- Create index for stripe_subscription_id lookups
CREATE INDEX IF NOT EXISTS idx_detailers_stripe_subscription_id 
ON detailers(stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The detailers table now supports hybrid pricing models.
-- Existing detailers will have pricing_model = NULL, which should default
-- to 'percentage' behavior in application logic.
-- ============================================================================

