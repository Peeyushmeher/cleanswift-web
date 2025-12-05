-- ============================================================================
-- Add Subscription Platform Fee Setting
-- ============================================================================
-- This migration adds the subscription_platform_fee_percentage setting
-- to platform_settings table. This is the fee percentage (3%) applied
-- to detailers on subscription model (for payment processing only).
-- ============================================================================

-- Insert subscription platform fee setting if it doesn't exist
INSERT INTO platform_settings (key, value, description)
VALUES (
  'subscription_platform_fee_percentage',
  '3.00'::jsonb,
  'Platform fee percentage for detailers on subscription model (for payment processing). Default: 3%'
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The subscription_platform_fee_percentage setting has been added.
-- This can be retrieved using the existing platform_settings query pattern.
-- ============================================================================

