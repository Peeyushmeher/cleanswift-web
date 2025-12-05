-- ============================================================================
-- Create Detailer Days Off Table
-- ============================================================================
-- This migration creates a table to store explicit days off for detailers.
-- This allows detailers to mark specific dates as unavailable (e.g., holidays,
-- vacations, personal days) separate from their weekly availability schedule.
--
-- Schema:
-- - detailer_id: Links to detailers table
-- - date: The date that is marked as a day off
-- - reason: Optional reason for the day off (e.g., "Holiday", "Vacation")
-- - is_active: Allows temporarily disabling a day off without deleting it
-- ============================================================================

CREATE TABLE IF NOT EXISTS detailer_days_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(detailer_id, date)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_detailer_days_off_detailer_id ON detailer_days_off(detailer_id);
CREATE INDEX IF NOT EXISTS idx_detailer_days_off_date ON detailer_days_off(date);
CREATE INDEX IF NOT EXISTS idx_detailer_days_off_active ON detailer_days_off(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_detailer_days_off_detailer_date ON detailer_days_off(detailer_id, date) WHERE is_active = true;

-- Add updated_at trigger
CREATE TRIGGER update_detailer_days_off_updated_at 
  BEFORE UPDATE ON detailer_days_off
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE detailer_days_off ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Detailers can view and manage their own days off
CREATE POLICY "Detailers can view their own days off"
  ON detailer_days_off FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_days_off.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

CREATE POLICY "Detailers can insert their own days off"
  ON detailer_days_off FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_days_off.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

CREATE POLICY "Detailers can update their own days off"
  ON detailer_days_off FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_days_off.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_days_off.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

CREATE POLICY "Detailers can delete their own days off"
  ON detailer_days_off FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_days_off.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

-- Admins can view all days off
CREATE POLICY "Admins can view all days off"
  ON detailer_days_off FOR SELECT
  USING (is_admin());

-- Admins can manage all days off
CREATE POLICY "Admins can manage all days off"
  ON detailer_days_off FOR ALL
  USING (is_admin());

COMMENT ON TABLE detailer_days_off IS 'Stores explicit days off for detailers (holidays, vacations, etc.). Used to exclude dates from availability.';
COMMENT ON COLUMN detailer_days_off.detailer_id IS 'Reference to the detailer';
COMMENT ON COLUMN detailer_days_off.date IS 'The date marked as a day off';
COMMENT ON COLUMN detailer_days_off.reason IS 'Optional reason for the day off (e.g., "Holiday", "Vacation")';
COMMENT ON COLUMN detailer_days_off.is_active IS 'Whether this day off is currently active';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The detailer_days_off table is now ready for use.
-- Next: Update availability functions to handle lunch breaks and days off.
-- ============================================================================

