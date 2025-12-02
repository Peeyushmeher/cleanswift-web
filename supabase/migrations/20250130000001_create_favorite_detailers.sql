-- Migration: Create favorite_detailers table
-- Allows users to save favorite detailers for quick access and rebooking

CREATE TABLE IF NOT EXISTS favorite_detailers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_detailer_favorite UNIQUE(user_id, detailer_id)
);

-- Index for efficient lookups by user
CREATE INDEX IF NOT EXISTS idx_favorite_detailers_user_id ON favorite_detailers(user_id);

-- Index for efficient lookups by detailer
CREATE INDEX IF NOT EXISTS idx_favorite_detailers_detailer_id ON favorite_detailers(detailer_id);

-- Enable RLS
ALTER TABLE favorite_detailers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own favorites
CREATE POLICY "Users can view own favorites"
    ON favorite_detailers
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can add their own favorites
CREATE POLICY "Users can add own favorites"
    ON favorite_detailers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove their own favorites
CREATE POLICY "Users can delete own favorites"
    ON favorite_detailers
    FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON TABLE favorite_detailers IS 'Stores user favorite detailers for quick booking access';

