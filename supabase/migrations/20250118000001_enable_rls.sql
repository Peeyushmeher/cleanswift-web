-- ============================================================================
-- Enable Row Level Security (RLS) on all tables
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE detailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES - Users can read and update their own profile
-- ============================================================================
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- CARS - Users can manage their own cars
-- ============================================================================
CREATE POLICY "Users can view their own cars"
  ON cars FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cars"
  ON cars FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cars"
  ON cars FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cars"
  ON cars FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SERVICES - Everyone can view active services (public catalog)
-- ============================================================================
CREATE POLICY "Anyone can view active services"
  ON services FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- SERVICE_ADDONS - Everyone can view active addons (public catalog)
-- ============================================================================
CREATE POLICY "Anyone can view active service addons"
  ON service_addons FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- DETAILERS - Everyone can view active detailers (public catalog)
-- ============================================================================
CREATE POLICY "Anyone can view active detailers"
  ON detailers FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- PAYMENT_METHODS - Users can manage their own payment methods
-- ============================================================================
CREATE POLICY "Users can view their own payment methods"
  ON payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
  ON payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
  ON payment_methods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods"
  ON payment_methods FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- BOOKINGS - Users can manage their own bookings
-- ============================================================================
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- BOOKING_ADDONS - Users can view addons for their own bookings
-- ============================================================================
CREATE POLICY "Users can view addons for their own bookings"
  ON booking_addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_addons.booking_id
      AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert addons for their own bookings"
  ON booking_addons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_addons.booking_id
      AND bookings.user_id = auth.uid()
    )
  );

-- ============================================================================
-- REVIEWS - Users can manage their own reviews
-- ============================================================================
CREATE POLICY "Users can view their own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view all reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATION_SETTINGS - Users can manage their own notification settings
-- ============================================================================
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id);
