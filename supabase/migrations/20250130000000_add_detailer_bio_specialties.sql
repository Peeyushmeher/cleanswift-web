-- Migration: Add bio and specialties columns to detailers table
-- This enables richer detailer profiles with personal bios and specialty tags

-- Add bio column for personal description
ALTER TABLE detailers ADD COLUMN IF NOT EXISTS bio text;

-- Add specialties column as text array for specialty tags
ALTER TABLE detailers ADD COLUMN IF NOT EXISTS specialties text[];

-- Add index for searching specialties
CREATE INDEX IF NOT EXISTS idx_detailers_specialties ON detailers USING GIN (specialties);

-- Add some sample data for existing detailers (optional, for development)
COMMENT ON COLUMN detailers.bio IS 'Personal bio/description for the detailer profile';
COMMENT ON COLUMN detailers.specialties IS 'Array of specialty tags (e.g., ceramic coating, interior detailing)';

