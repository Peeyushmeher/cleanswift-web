-- ============================================================================
-- Phase 1: Backend Foundations Migration
-- ============================================================================
-- This migration adds:
-- 1. Enum types for roles and statuses
-- 2. Role column to profiles
-- 3. booking_services junction table (for multi-service bookings)
-- 4. payments table (separate payment tracking)
-- 5. Enhanced bookings columns (payment_status, stripe_payment_intent_id, receipt_id FK)
-- 6. Updated RLS policies supporting roles (user, detailer, admin)
--
-- IMPORTANT: This migration maintains backward compatibility with existing
-- frontend code. Existing columns and relationships are preserved.
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Enum Types
-- ============================================================================

-- User role enum (for profiles.role)
DO $$
BEGIN
  CREATE TYPE user_role_enum AS ENUM ('user', 'detailer', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON TYPE user_role_enum IS 'User roles: user (customer), detailer (service provider), admin (platform administrator)';

-- Booking status enum (enhanced version of existing status CHECK constraint)
-- NOTE: The bookings.status column currently uses a CHECK constraint with values:
-- 'scheduled', 'in_progress', 'completed', 'canceled'
-- This enum is created for future use. The status column will be migrated to use
-- this enum in a future phase to maintain backward compatibility with existing code.
DO $$
BEGIN
  CREATE TYPE booking_status_enum AS ENUM (
    'pending',           -- user started booking, not confirmed
    'requires_payment',  -- booking info complete, waiting for payment
    'paid',              -- user paid, before detailer assignment
    'offered',           -- broadcasted to detailers / awaiting acceptance
    'accepted',          -- accepted by a detailer
    'in_progress',       -- detailer is working
    'completed',         -- job done
    'cancelled',         -- cancelled by user/admin
    'no_show'            -- user or detailer didn't show
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON TYPE booking_status_enum IS 'Booking lifecycle statuses (for future migration of bookings.status column)';

-- Payment status enum
DO $$
BEGIN
  CREATE TYPE payment_status_enum AS ENUM (
    'unpaid',
    'requires_payment',
    'processing',
    'paid',
    'refunded',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON TYPE payment_status_enum IS 'Payment processing statuses';

-- ============================================================================
-- STEP 2: Add role column to profiles
-- ============================================================================

-- Add role column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN role user_role_enum NOT NULL DEFAULT 'user';
    
    COMMENT ON COLUMN profiles.role IS 'User role: user (customer), detailer (service provider), or admin';
  END IF;
END
$$;

-- ============================================================================
-- STEP 3: Create booking_services junction table
-- ============================================================================
-- This allows a booking to have multiple services (future enhancement)
-- For now, existing bookings use service_id directly in bookings table

CREATE TABLE IF NOT EXISTS booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service_id ON booking_services(service_id);

COMMENT ON TABLE booking_services IS 'Junction table linking bookings to services (supports multi-service bookings)';
COMMENT ON COLUMN booking_services.booking_id IS 'Reference to the booking';
COMMENT ON COLUMN booking_services.service_id IS 'Reference to the service';
COMMENT ON COLUMN booking_services.quantity IS 'Quantity of this service in the booking';

-- ============================================================================
-- STEP 4: Create payments table
-- ============================================================================
-- Separate table for payment tracking (linked to bookings)

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  status payment_status_enum NOT NULL DEFAULT 'requires_payment',
  stripe_payment_intent_id text,
  stripe_charge_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

COMMENT ON TABLE payments IS 'Payment records linked to bookings';
COMMENT ON COLUMN payments.booking_id IS 'Reference to the booking this payment is for';
COMMENT ON COLUMN payments.amount_cents IS 'Payment amount in cents';
COMMENT ON COLUMN payments.currency IS 'Currency code (default: CAD)';
COMMENT ON COLUMN payments.status IS 'Current payment status';
COMMENT ON COLUMN payments.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN payments.stripe_charge_id IS 'Stripe Charge ID (after payment succeeds)';

-- Add updated_at trigger for payments
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Enhance bookings table with new columns
-- ============================================================================
-- Add new columns without removing existing ones to maintain backward compatibility

-- Add payment_status column (using enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN payment_status payment_status_enum NOT NULL DEFAULT 'unpaid';
    
    COMMENT ON COLUMN bookings.payment_status IS 'Payment status for this booking';
  END IF;
END
$$;

-- Add stripe_payment_intent_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN stripe_payment_intent_id text;
    
    CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id ON bookings(stripe_payment_intent_id);
    COMMENT ON COLUMN bookings.stripe_payment_intent_id IS 'Stripe PaymentIntent ID for this booking';
  END IF;
END
$$;

-- Add receipt_id FK column (references payments.id)
-- Note: existing bookings have receipt_id as text (unique identifier)
-- We'll add a new column receipt_payment_id that links to payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'receipt_payment_id'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN receipt_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_bookings_receipt_payment_id ON bookings(receipt_payment_id);
    COMMENT ON COLUMN bookings.receipt_payment_id IS 'Reference to payments table (receipt)';
  END IF;
END
$$;

-- Add scheduled_start and scheduled_end as timestamptz (computed from existing date/time)
-- These are optional and can be derived from scheduled_date + scheduled_time_start
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'scheduled_start'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN scheduled_start timestamptz;
    
    COMMENT ON COLUMN bookings.scheduled_start IS 'Scheduled start time (computed from scheduled_date + scheduled_time_start)';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'scheduled_end'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN scheduled_end timestamptz;
    
    COMMENT ON COLUMN bookings.scheduled_end IS 'Scheduled end time (computed from scheduled_date + scheduled_time_end)';
  END IF;
END
$$;

-- Add location_address (computed from existing address fields)
-- This is optional and can be derived from address_line1, city, province, postal_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'location_address'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN location_address text;
    
    COMMENT ON COLUMN bookings.location_address IS 'Full address string (computed from address_line1, city, province, postal_code)';
  END IF;
END
$$;

-- Add location_lat and location_lng (aliases for existing latitude/longitude)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN location_lat double precision;
    
    COMMENT ON COLUMN bookings.location_lat IS 'Location latitude (alias for latitude column)';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'location_lng'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN location_lng double precision;
    
    COMMENT ON COLUMN bookings.location_lng IS 'Location longitude (alias for longitude column)';
  END IF;
END
$$;

-- ============================================================================
-- STEP 6: Update RLS Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES - Enhanced with role-based access
-- ============================================================================

-- Drop existing policies if they exist (we'll recreate them with role support)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ============================================================================
-- CARS - Enhanced with admin access
-- ============================================================================

-- Keep existing user policies, add admin policies
DROP POLICY IF EXISTS "Admins can access all cars" ON cars;
CREATE POLICY "Admins can access all cars"
  ON cars FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ============================================================================
-- BOOKINGS - Enhanced with detailer and admin access
-- ============================================================================

-- Keep existing user policies, add detailer and admin policies

-- Detailers can view bookings assigned to them
-- NOTE: Currently detailer_id references detailers table, not profiles.
-- This policy will work once detailers are linked to profiles (future migration).
-- For now, detailers with role='detailer' in profiles can view bookings where
-- detailer_id matches their profile id (once linked).
DROP POLICY IF EXISTS "Detailers can view assigned bookings" ON bookings;
CREATE POLICY "Detailers can view assigned bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'detailer'
        AND bookings.detailer_id = p.id
    )
  );

-- Detailers can update status of assigned bookings
-- NOTE: Same limitation as above - requires detailer-profiles link
DROP POLICY IF EXISTS "Detailers can update assigned bookings" ON bookings;
CREATE POLICY "Detailers can update assigned bookings"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'detailer'
        AND bookings.detailer_id = p.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'detailer'
        AND bookings.detailer_id = p.id
    )
  );

-- Admins can manage all bookings
DROP POLICY IF EXISTS "Admins can manage all bookings" ON bookings;
CREATE POLICY "Admins can manage all bookings"
  ON bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ============================================================================
-- BOOKING_SERVICES - RLS policies
-- ============================================================================

-- Users can view booking_services for their own bookings
CREATE POLICY "Users can view booking_services for their bookings"
  ON booking_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_services.booking_id
        AND b.user_id = auth.uid()
    )
  );

-- Users can insert booking_services for their own bookings
CREATE POLICY "Users can insert booking_services for their bookings"
  ON booking_services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_services.booking_id
        AND b.user_id = auth.uid()
    )
  );

-- Detailers can view booking_services for assigned bookings
CREATE POLICY "Detailers can view booking_services for assigned bookings"
  ON booking_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN profiles p ON p.id = auth.uid()
      WHERE b.id = booking_services.booking_id
        AND p.role = 'detailer'
        AND b.detailer_id = p.id
    )
  );

-- Admins can manage all booking_services
CREATE POLICY "Admins can manage all booking_services"
  ON booking_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ============================================================================
-- PAYMENTS - RLS policies
-- ============================================================================

-- Users can view payments for their own bookings
CREATE POLICY "Users can view payments for their bookings"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = payments.booking_id
        AND b.user_id = auth.uid()
    )
  );

-- Users can insert payments for their own bookings
CREATE POLICY "Users can insert payments for their bookings"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = payments.booking_id
        AND b.user_id = auth.uid()
    )
  );

-- Users can update payments for their own bookings (limited - typically done by system)
CREATE POLICY "Users can update payments for their bookings"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = payments.booking_id
        AND b.user_id = auth.uid()
    )
  );

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Summary of changes:
-- 1. ✅ Created enum types: user_role_enum, booking_status_enum, payment_status_enum
-- 2. ✅ Added role column to profiles (default: 'user')
-- 3. ✅ Created booking_services junction table
-- 4. ✅ Created payments table
-- 5. ✅ Enhanced bookings table with new columns (backward compatible)
-- 6. ✅ Updated RLS policies with role-based access (user, detailer, admin)
--
-- Note: Existing frontend code continues to work:
-- - bookings.service_id (single service) still works
-- - bookings.detailer_id (references detailers table) still works
-- - All existing columns preserved
-- ============================================================================

