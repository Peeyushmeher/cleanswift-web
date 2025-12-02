-- ============================================================================
-- Create Detailer Availability Table
-- ============================================================================
-- This migration creates a table to store detailer availability schedules.
-- Detailers can set recurring weekly availability (e.g., Mon-Fri 9am-5pm).
-- The system uses this to automatically assign bookings to available detailers.
--
-- Schema:
-- - detailer_id: Links to detailers table
-- - day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
-- - start_time: Time when detailer becomes available (e.g., '09:00:00')
-- - end_time: Time when detailer stops being available (e.g., '17:00:00')
-- - is_active: Allows temporarily disabling availability slots
-- ============================================================================

CREATE TABLE IF NOT EXISTS detailer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(detailer_id, day_of_week, start_time, end_time)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_detailer_availability_detailer_id ON detailer_availability(detailer_id);
CREATE INDEX IF NOT EXISTS idx_detailer_availability_day_active ON detailer_availability(day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_detailer_availability_active ON detailer_availability(is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE TRIGGER update_detailer_availability_updated_at 
  BEFORE UPDATE ON detailer_availability
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE detailer_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Detailers can view and manage their own availability
CREATE POLICY "Detailers can view their own availability"
  ON detailer_availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_availability.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

CREATE POLICY "Detailers can insert their own availability"
  ON detailer_availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_availability.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

CREATE POLICY "Detailers can update their own availability"
  ON detailer_availability FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_availability.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_availability.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

CREATE POLICY "Detailers can delete their own availability"
  ON detailer_availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM detailers d
      JOIN profiles p ON p.id = d.profile_id
      WHERE d.id = detailer_availability.detailer_id
        AND p.id = auth.uid()
        AND p.role = 'detailer'
    )
  );

-- Admins can view all availability
CREATE POLICY "Admins can view all availability"
  ON detailer_availability FOR SELECT
  USING (is_admin());

-- Admins can manage all availability
CREATE POLICY "Admins can manage all availability"
  ON detailer_availability FOR ALL
  USING (is_admin());

COMMENT ON TABLE detailer_availability IS 'Stores detailer availability schedules. Used for automatic booking assignment.';
COMMENT ON COLUMN detailer_availability.day_of_week IS 'Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN detailer_availability.start_time IS 'Time when detailer becomes available (e.g., 09:00:00)';
COMMENT ON COLUMN detailer_availability.end_time IS 'Time when detailer stops being available (e.g., 17:00:00)';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The detailer_availability table is now ready for use.
-- Next: Create RPC functions for managing availability and auto-assignment.
-- ============================================================================

