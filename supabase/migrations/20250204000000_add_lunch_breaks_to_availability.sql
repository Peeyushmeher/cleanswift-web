-- ============================================================================
-- Add Lunch Breaks to Detailer Availability
-- ============================================================================
-- This migration adds lunch break support to the detailer_availability table.
-- Detailers can now specify optional lunch break times for each day.
--
-- Changes:
-- - Add lunch_start_time and lunch_end_time columns (nullable)
-- - Add constraint to ensure lunch_end_time > lunch_start_time when both are set
-- ============================================================================

-- Add lunch break columns
DO $$
BEGIN
  -- Add lunch_start_time column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detailer_availability' AND column_name = 'lunch_start_time'
  ) THEN
    ALTER TABLE detailer_availability
      ADD COLUMN lunch_start_time time;
    
    COMMENT ON COLUMN detailer_availability.lunch_start_time IS 'Optional lunch break start time (e.g., 12:00:00)';
  END IF;

  -- Add lunch_end_time column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'detailer_availability' AND column_name = 'lunch_end_time'
  ) THEN
    ALTER TABLE detailer_availability
      ADD COLUMN lunch_end_time time;
    
    COMMENT ON COLUMN detailer_availability.lunch_end_time IS 'Optional lunch break end time (e.g., 13:00:00)';
  END IF;
END
$$;

-- Add constraint to ensure lunch_end_time > lunch_start_time when both are set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'detailer_availability_lunch_time_check'
  ) THEN
    ALTER TABLE detailer_availability
      ADD CONSTRAINT detailer_availability_lunch_time_check
      CHECK (
        (lunch_start_time IS NULL AND lunch_end_time IS NULL) OR
        (lunch_start_time IS NOT NULL AND lunch_end_time IS NOT NULL AND lunch_end_time > lunch_start_time)
      );
  END IF;
END
$$;

-- Add comment to table
COMMENT ON COLUMN detailer_availability.lunch_start_time IS 'Optional lunch break start time. Must be set together with lunch_end_time.';
COMMENT ON COLUMN detailer_availability.lunch_end_time IS 'Optional lunch break end time. Must be set together with lunch_start_time.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The detailer_availability table now supports lunch breaks.
-- Next: Create detailer_days_off table and update availability functions.
-- ============================================================================

