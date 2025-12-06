-- ============================================================================
-- Add Stripe Connect Account ID to Detailers Table
-- ============================================================================
-- This migration adds stripe_connect_account_id to detailers table
-- to enable Stripe Connect payouts for solo detailers
-- ============================================================================

-- Add stripe_connect_account_id column to detailers table
ALTER TABLE detailers 
ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

COMMENT ON COLUMN detailers.stripe_connect_account_id IS 
'Stripe Connect account ID for solo detailer payouts. NULL if not connected. Organizations use organizations.stripe_connect_account_id.';

-- Create index for stripe_connect_account_id lookups
CREATE INDEX IF NOT EXISTS idx_detailers_stripe_connect_account_id 
ON detailers(stripe_connect_account_id) 
WHERE stripe_connect_account_id IS NOT NULL;

