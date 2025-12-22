-- ============================================================================
-- Add Weekly Payout Batches for Solo Detailers
-- ============================================================================
-- This migration creates the solo_weekly_payout_batches table to track
-- weekly batch payouts for solo detailers, and adds weekly_payout_batch_id
-- to detailer_transfers to link transfers to their weekly batch.
-- ============================================================================

-- Create batch status enum (similar to transfer_status_enum)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_status_enum') THEN
    CREATE TYPE batch_status_enum AS ENUM (
      'pending',      -- Batch created, not yet processed
      'processing',   -- Stripe transfer created, awaiting confirmation
      'succeeded',    -- Batch completed successfully
      'failed'        -- Batch failed
    );
  END IF;
END
$$;

COMMENT ON TYPE batch_status_enum IS 'Status of a weekly payout batch';

-- Create solo_weekly_payout_batches table
CREATE TABLE IF NOT EXISTS solo_weekly_payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,  -- Monday of the week
  week_end_date date NOT NULL,    -- Sunday of the week
  total_amount_cents integer NOT NULL DEFAULT 0,
  total_transfers integer NOT NULL DEFAULT 0,
  stripe_transfer_id text,
  status batch_status_enum NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ensure one batch per detailer per week
  UNIQUE(detailer_id, week_start_date)
);

COMMENT ON TABLE solo_weekly_payout_batches IS 'Tracks weekly payout batches for solo detailers';
COMMENT ON COLUMN solo_weekly_payout_batches.detailer_id IS 'Reference to the solo detailer receiving the batch payout';
COMMENT ON COLUMN solo_weekly_payout_batches.week_start_date IS 'Monday date of the week covered by this batch';
COMMENT ON COLUMN solo_weekly_payout_batches.week_end_date IS 'Sunday date of the week covered by this batch';
COMMENT ON COLUMN solo_weekly_payout_batches.total_amount_cents IS 'Total payout amount in cents (sum of all transfers in batch)';
COMMENT ON COLUMN solo_weekly_payout_batches.total_transfers IS 'Number of transfers included in this batch';
COMMENT ON COLUMN solo_weekly_payout_batches.stripe_transfer_id IS 'Stripe transfer ID after batch is processed';
COMMENT ON COLUMN solo_weekly_payout_batches.status IS 'Current status of the batch';
COMMENT ON COLUMN solo_weekly_payout_batches.processed_at IS 'Timestamp when batch was processed (Stripe transfer created)';
COMMENT ON COLUMN solo_weekly_payout_batches.error_message IS 'Error details if batch fails';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_solo_weekly_payout_batches_detailer_id ON solo_weekly_payout_batches(detailer_id);
CREATE INDEX IF NOT EXISTS idx_solo_weekly_payout_batches_week_start ON solo_weekly_payout_batches(week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_solo_weekly_payout_batches_status ON solo_weekly_payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_solo_weekly_payout_batches_stripe_transfer_id ON solo_weekly_payout_batches(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;

-- Add updated_at trigger
CREATE TRIGGER update_solo_weekly_payout_batches_updated_at 
  BEFORE UPDATE ON solo_weekly_payout_batches
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add weekly_payout_batch_id column to detailer_transfers
ALTER TABLE detailer_transfers
  ADD COLUMN IF NOT EXISTS weekly_payout_batch_id uuid REFERENCES solo_weekly_payout_batches(id) ON DELETE SET NULL;

COMMENT ON COLUMN detailer_transfers.weekly_payout_batch_id IS 'Reference to the weekly payout batch this transfer belongs to. NULL for transfers processed individually (legacy) or not yet batched.';

-- Create index for weekly_payout_batch_id
CREATE INDEX IF NOT EXISTS idx_detailer_transfers_weekly_payout_batch_id 
  ON detailer_transfers(weekly_payout_batch_id) 
  WHERE weekly_payout_batch_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE solo_weekly_payout_batches ENABLE ROW LEVEL SECURITY;

-- Detailers can view their own weekly payout batches
CREATE POLICY "Detailers can view their own weekly payout batches"
  ON solo_weekly_payout_batches FOR SELECT
  USING (
    detailer_id IN (
      SELECT id FROM detailers WHERE profile_id = auth.uid()
    )
  );

-- Note: Edge Functions use service role key, so they bypass RLS for inserts/updates
-- This is intentional - batches are created/updated by system functions, not directly by users

