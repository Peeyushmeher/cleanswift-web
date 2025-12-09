-- ============================================================================
-- Create Detailer Transfers Table for On-Demand Stripe Connect Payouts
-- ============================================================================
-- This migration creates the detailer_transfers table to track individual
-- Stripe Connect transfers for solo detailers when bookings are completed.
-- ============================================================================

-- Create transfer status enum (check if it exists first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status_enum') THEN
    CREATE TYPE transfer_status_enum AS ENUM (
      'pending',      -- Transfer record created, not yet processed
      'processing',   -- Transfer submitted to Stripe, awaiting confirmation
      'succeeded',    -- Transfer completed successfully
      'failed',       -- Transfer failed (non-retryable or max retries reached)
      'retry_pending' -- Transfer failed but queued for retry
    );
  END IF;
END
$$;

COMMENT ON TYPE transfer_status_enum IS 'Status of a Stripe Connect transfer to a detailer';

-- Create detailer_transfers table
CREATE TABLE IF NOT EXISTS detailer_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  stripe_transfer_id text,
  status transfer_status_enum NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id) -- Prevent duplicate transfers per booking
);

COMMENT ON TABLE detailer_transfers IS 'Tracks individual Stripe Connect transfers to solo detailers for completed bookings';
COMMENT ON COLUMN detailer_transfers.booking_id IS 'Reference to the completed booking';
COMMENT ON COLUMN detailer_transfers.detailer_id IS 'Reference to the solo detailer receiving the transfer';
COMMENT ON COLUMN detailer_transfers.amount_cents IS 'Transfer amount in cents (detailer payout)';
COMMENT ON COLUMN detailer_transfers.platform_fee_cents IS 'Platform fee deducted in cents';
COMMENT ON COLUMN detailer_transfers.stripe_transfer_id IS 'Stripe transfer ID after creation';
COMMENT ON COLUMN detailer_transfers.status IS 'Current status of the transfer';
COMMENT ON COLUMN detailer_transfers.error_message IS 'Error details if transfer fails';
COMMENT ON COLUMN detailer_transfers.retry_count IS 'Number of retry attempts made';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_detailer_transfers_detailer_id ON detailer_transfers(detailer_id);
CREATE INDEX IF NOT EXISTS idx_detailer_transfers_booking_id ON detailer_transfers(booking_id);
CREATE INDEX IF NOT EXISTS idx_detailer_transfers_status ON detailer_transfers(status);
CREATE INDEX IF NOT EXISTS idx_detailer_transfers_stripe_transfer_id ON detailer_transfers(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_detailer_transfers_retry_pending ON detailer_transfers(status, retry_count) WHERE status IN ('retry_pending', 'failed');

-- Add updated_at trigger
CREATE TRIGGER update_detailer_transfers_updated_at 
  BEFORE UPDATE ON detailer_transfers
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE detailer_transfers ENABLE ROW LEVEL SECURITY;

-- Detailers can view their own transfers
CREATE POLICY "Detailers can view their own transfers"
  ON detailer_transfers FOR SELECT
  USING (
    detailer_id IN (
      SELECT id FROM detailers WHERE profile_id = auth.uid()
    )
  );

-- Note: Edge Functions use service role key, so they bypass RLS for inserts/updates
-- This is intentional - transfers are created/updated by system functions, not directly by users

