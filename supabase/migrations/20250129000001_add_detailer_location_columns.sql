-- ============================================================================
-- Add Location Columns to Detailers Table
-- ============================================================================
-- This migration adds location tracking to detailers for distance-based
-- booking assignment. Detailers can set their service area using:
-- - latitude/longitude: Their base location
-- - service_radius_km: How far they're willing to travel
-- ============================================================================

-- Add location columns
ALTER TABLE detailers 
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric,
ADD COLUMN IF NOT EXISTS service_radius_km integer DEFAULT 50;

-- Add comments
COMMENT ON COLUMN detailers.latitude IS 'Base location latitude for the detailer (used for distance-based assignment)';
COMMENT ON COLUMN detailers.longitude IS 'Base location longitude for the detailer (used for distance-based assignment)';
COMMENT ON COLUMN detailers.service_radius_km IS 'Maximum distance (km) the detailer is willing to travel for jobs. Default 50km.';

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_detailers_location 
ON detailers(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

