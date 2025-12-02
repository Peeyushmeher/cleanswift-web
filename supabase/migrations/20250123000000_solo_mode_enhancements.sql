-- ============================================================================
-- Solo Mode Dashboard Enhancements
-- ============================================================================
-- This migration adds tables and policies needed for the detailer dashboard:
-- 1. booking_notes - Internal notes on bookings
-- 2. booking_timeline - Track status transitions with timestamps
-- 3. job_photos - Before/after photos for jobs
-- 4. service_areas - Detailer coverage zones (for future use)
-- ============================================================================

-- ============================================================================
-- 1. BOOKING_NOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS booking_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    note_text text NOT NULL,
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_notes_booking_id ON booking_notes(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_notes_created_by ON booking_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_booking_notes_created_at ON booking_notes(created_at DESC);

COMMENT ON TABLE booking_notes IS 'Internal notes for bookings, visible to detailers and admins';
COMMENT ON COLUMN booking_notes.booking_id IS 'Reference to the booking this note belongs to';
COMMENT ON COLUMN booking_notes.note_text IS 'The note content';
COMMENT ON COLUMN booking_notes.created_by IS 'User who created the note';

-- Add updated_at trigger
CREATE TRIGGER update_booking_notes_updated_at BEFORE UPDATE ON booking_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. BOOKING_TIMELINE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS booking_timeline (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    status_from text,
    status_to text NOT NULL,
    changed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    changed_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

CREATE INDEX IF NOT EXISTS idx_booking_timeline_booking_id ON booking_timeline(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_timeline_changed_at ON booking_timeline(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_timeline_changed_by ON booking_timeline(changed_by);

COMMENT ON TABLE booking_timeline IS 'Tracks all status transitions for bookings with timestamps';
COMMENT ON COLUMN booking_timeline.status_from IS 'Previous status (null for initial state)';
COMMENT ON COLUMN booking_timeline.status_to IS 'New status';
COMMENT ON COLUMN booking_timeline.changed_by IS 'User who made the status change';
COMMENT ON COLUMN booking_timeline.changed_at IS 'When the status change occurred';

-- ============================================================================
-- 3. JOB_PHOTOS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    photo_url text NOT NULL,
    photo_type text NOT NULL CHECK (photo_type IN ('before', 'after')),
    uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_photos_booking_id ON job_photos(booking_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_photo_type ON job_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_job_photos_uploaded_at ON job_photos(uploaded_at DESC);

COMMENT ON TABLE job_photos IS 'Before/after photos uploaded for jobs';
COMMENT ON COLUMN job_photos.photo_url IS 'URL to the photo in Supabase Storage';
COMMENT ON COLUMN job_photos.photo_type IS 'Type of photo: before or after';
COMMENT ON COLUMN job_photos.uploaded_by IS 'User who uploaded the photo';

-- ============================================================================
-- 4. SERVICE_AREAS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
    area_name text NOT NULL,
    city text NOT NULL,
    province text NOT NULL,
    postal_code text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_areas_detailer_id ON service_areas(detailer_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_city_province ON service_areas(city, province);
CREATE INDEX IF NOT EXISTS idx_service_areas_is_active ON service_areas(is_active);

COMMENT ON TABLE service_areas IS 'Service coverage zones for detailers';
COMMENT ON COLUMN service_areas.detailer_id IS 'Reference to the detailer';
COMMENT ON COLUMN service_areas.area_name IS 'Name of the service area (e.g., Downtown Toronto)';
COMMENT ON COLUMN service_areas.postal_code IS 'Postal code or code range (optional)';

-- Add updated_at trigger
CREATE TRIGGER update_service_areas_updated_at BEFORE UPDATE ON service_areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

-- BOOKING_NOTES Policies
-- Detailers can view/create notes for their bookings
CREATE POLICY "Detailers can view notes for their bookings"
    ON booking_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = booking_notes.booking_id
            AND (
                bookings.detailer_id IN (
                    SELECT id FROM detailers WHERE profile_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'detailer')
                )
            )
        )
    );

CREATE POLICY "Detailers can create notes for their bookings"
    ON booking_notes FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = booking_notes.booking_id
            AND (
                bookings.detailer_id IN (
                    SELECT id FROM detailers WHERE profile_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Detailers can update their own notes"
    ON booking_notes FOR UPDATE
    USING (created_by = auth.uid());

-- BOOKING_TIMELINE Policies
-- Detailers can view timeline for their bookings
CREATE POLICY "Detailers can view timeline for their bookings"
    ON booking_timeline FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = booking_timeline.booking_id
            AND (
                bookings.detailer_id IN (
                    SELECT id FROM detailers WHERE profile_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'detailer')
                )
            )
        )
    );

-- System/backend can insert timeline entries (via RPC functions)
CREATE POLICY "System can insert timeline entries"
    ON booking_timeline FOR INSERT
    WITH CHECK (true); -- RPC functions will validate permissions

-- JOB_PHOTOS Policies
-- Detailers can view/upload photos for their bookings
CREATE POLICY "Detailers can view photos for their bookings"
    ON job_photos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = job_photos.booking_id
            AND (
                bookings.detailer_id IN (
                    SELECT id FROM detailers WHERE profile_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'detailer')
                )
            )
        )
    );

CREATE POLICY "Detailers can upload photos for their bookings"
    ON job_photos FOR INSERT
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = job_photos.booking_id
            AND (
                bookings.detailer_id IN (
                    SELECT id FROM detailers WHERE profile_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Detailers can delete their own photos"
    ON job_photos FOR DELETE
    USING (uploaded_by = auth.uid());

-- SERVICE_AREAS Policies
-- Detailers can manage their own service areas
CREATE POLICY "Detailers can view their own service areas"
    ON service_areas FOR SELECT
    USING (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Detailers can create their own service areas"
    ON service_areas FOR INSERT
    WITH CHECK (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Detailers can update their own service areas"
    ON service_areas FOR UPDATE
    USING (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "Detailers can delete their own service areas"
    ON service_areas FOR DELETE
    USING (
        detailer_id IN (
            SELECT id FROM detailers WHERE profile_id = auth.uid()
        )
    );

-- ============================================================================
-- Migration Complete
-- ============================================================================
