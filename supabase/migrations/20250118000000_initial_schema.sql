-- ============================================================================
-- CleanSwift Database Schema - FINAL VERSION
-- ============================================================================
-- This schema is LOCKED and must not be modified without explicit approval.
-- ============================================================================

-- Enable UUID extension (PostgreSQL 13+ has gen_random_uuid() built-in)

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL UNIQUE,
    phone text NOT NULL,
    avatar_url text,
    stripe_customer_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. CARS
-- ============================================================================
CREATE TABLE cars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    make text NOT NULL,
    model text NOT NULL,
    year text NOT NULL,
    trim text,
    license_plate text NOT NULL,
    color text,
    photo_url text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cars_user_id ON cars(user_id);
CREATE INDEX idx_cars_user_primary ON cars(user_id, is_primary);

-- ============================================================================
-- 3. SERVICES
-- ============================================================================
CREATE TABLE services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    duration_minutes integer,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_active_order ON services(is_active, display_order);

-- ============================================================================
-- 4. SERVICE_ADDONS
-- ============================================================================
CREATE TABLE service_addons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_addons_active_order ON service_addons(is_active, display_order);

-- ============================================================================
-- 5. DETAILERS
-- ============================================================================
CREATE TABLE detailers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    avatar_url text,
    rating numeric(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5),
    review_count integer NOT NULL DEFAULT 0,
    years_experience integer NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_detailers_active_rating ON detailers(is_active, rating DESC);

-- ============================================================================
-- 6. PAYMENT_METHODS
-- ============================================================================
CREATE TABLE payment_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    card_type text NOT NULL,
    last_four text NOT NULL,
    expiry_month text NOT NULL,
    expiry_year text NOT NULL,
    cardholder_name text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    stripe_payment_method_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_user_default ON payment_methods(user_id, is_default);

-- ============================================================================
-- 7. BOOKINGS
-- ============================================================================
CREATE TABLE bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id text NOT NULL UNIQUE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    car_id uuid NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    detailer_id uuid REFERENCES detailers(id) ON DELETE SET NULL,
    scheduled_date date NOT NULL,
    scheduled_time_start time NOT NULL,
    scheduled_time_end time,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    province text NOT NULL,
    postal_code text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    location_notes text,
    status text NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'canceled')),
    service_price numeric(10,2) NOT NULL,
    addons_total numeric(10,2) NOT NULL DEFAULT 0,
    tax_amount numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX idx_bookings_user_created ON bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_user_status ON bookings(user_id, status);
CREATE INDEX idx_bookings_scheduled ON bookings(scheduled_date, scheduled_time_start);
CREATE INDEX idx_bookings_receipt_id ON bookings(receipt_id);

-- ============================================================================
-- 8. BOOKING_ADDONS
-- ============================================================================
CREATE TABLE booking_addons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    addon_id uuid NOT NULL REFERENCES service_addons(id) ON DELETE RESTRICT,
    price numeric(10,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(booking_id, addon_id)
);

CREATE INDEX idx_booking_addons_booking_id ON booking_addons(booking_id);

-- ============================================================================
-- 9. REVIEWS
-- ============================================================================
CREATE TABLE reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    detailer_id uuid NOT NULL REFERENCES detailers(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text text,
    tip_amount numeric(10,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_detailer_id ON reviews(detailer_id);

-- ============================================================================
-- 10. NOTIFICATION_SETTINGS
-- ============================================================================
CREATE TABLE notification_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    push_enabled boolean NOT NULL DEFAULT true,
    sms_enabled boolean NOT NULL DEFAULT true,
    email_enabled boolean NOT NULL DEFAULT false,
    booking_confirmations boolean NOT NULL DEFAULT true,
    detailer_on_way boolean NOT NULL DEFAULT true,
    arrival_alerts boolean NOT NULL DEFAULT true,
    status_updates boolean NOT NULL DEFAULT true,
    completion_notifications boolean NOT NULL DEFAULT true,
    upcoming_reminders boolean NOT NULL DEFAULT true,
    maintenance_suggestions boolean NOT NULL DEFAULT false,
    special_offers boolean NOT NULL DEFAULT false,
    discount_announcements boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cars_updated_at BEFORE UPDATE ON cars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_addons_updated_at BEFORE UPDATE ON service_addons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_detailers_updated_at BEFORE UPDATE ON detailers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
