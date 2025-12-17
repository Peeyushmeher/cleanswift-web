-- ============================================================================
-- Add Stripe Fees to Bookings
-- ============================================================================
-- This migration adds Stripe processing fees to bookings so customers pay
-- for payment processing and Connect payout fees.
--
-- Fees:
-- - Stripe payment processing: 2.9% + CA$0.30 per transaction
-- - Stripe Connect payout: 0.25% + $0.25 per payout
-- ============================================================================

-- Add Stripe fee columns to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_processing_fee numeric(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS stripe_connect_fee numeric(10,2) DEFAULT 0.00;

COMMENT ON COLUMN bookings.stripe_processing_fee IS 'Stripe payment processing fee (2.9% + CA$0.30) paid by customer';
COMMENT ON COLUMN bookings.stripe_connect_fee IS 'Stripe Connect payout fee (0.25% + $0.25) paid by customer';

-- ============================================================================
-- Function: calculate_stripe_fees
-- ============================================================================
-- Calculates Stripe fees for a given amount
-- 
-- Parameters:
--   p_amount - The base amount (service price + tax) before Stripe fees
--
-- Returns: JSON object with processing_fee and connect_fee
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_stripe_fees(
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  -- Stripe payment processing fee: 2.9% + CA$0.30
  stripe_processing_percentage numeric := 2.9;
  stripe_processing_fixed numeric := 0.30;
  
  -- Stripe Connect payout fee: 0.25% + $0.25
  stripe_connect_percentage numeric := 0.25;
  stripe_connect_fixed numeric := 0.25;
  
  processing_fee numeric;
  connect_fee numeric;
BEGIN
  -- Calculate processing fee: 2.9% of amount + $0.30
  processing_fee := (p_amount * stripe_processing_percentage / 100) + stripe_processing_fixed;
  
  -- Calculate Connect fee: 0.25% of amount + $0.25
  connect_fee := (p_amount * stripe_connect_percentage / 100) + stripe_connect_fixed;
  
  -- Round to 2 decimal places
  processing_fee := ROUND(processing_fee, 2);
  connect_fee := ROUND(connect_fee, 2);
  
  RETURN jsonb_build_object(
    'processing_fee', processing_fee,
    'connect_fee', connect_fee,
    'total_stripe_fees', processing_fee + connect_fee
  );
END;
$$;

COMMENT ON FUNCTION public.calculate_stripe_fees IS 
'Calculates Stripe fees for a given amount. Returns processing fee (2.9% + $0.30) and Connect fee (0.25% + $0.25).';

GRANT EXECUTE ON FUNCTION public.calculate_stripe_fees TO authenticated;

-- ============================================================================
-- Update create_booking function to calculate and include Stripe fees
-- ============================================================================
-- Drop the old function first to avoid signature conflicts
DROP FUNCTION IF EXISTS public.create_booking(
  uuid, timestamptz, text, text, text, text, uuid[], double precision, double precision, text
);

CREATE OR REPLACE FUNCTION public.create_booking(
  p_car_id uuid,
  p_scheduled_start timestamptz,
  p_location_address text,
  p_city text,
  p_province text,
  p_postal_code text,
  p_service_ids uuid[],
  p_location_lat double precision DEFAULT NULL,
  p_location_lng double precision DEFAULT NULL,
  p_location_notes text DEFAULT NULL,
  p_tax_amount numeric DEFAULT 0.00,
  p_detailer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  new_booking_id uuid;
  total_price_cents int := 0;
  total_duration_minutes int := 0;
  service_count int;
  valid_service_count int;
  receipt_id text;
  scheduled_end_calc timestamptz;
  service_price numeric;
  subtotal numeric;
  stripe_fees jsonb;
  stripe_processing_fee numeric;
  stripe_connect_fee numeric;
  total_stripe_fees numeric;
  final_total numeric;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Validate car ownership
  IF NOT EXISTS (
    SELECT 1 FROM cars c
    WHERE c.id = p_car_id
      AND c.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Car does not belong to user';
  END IF;

  -- 3) Validate services and compute totals
  service_count := array_length(p_service_ids, 1);
  IF service_count IS NULL OR service_count = 0 THEN
    RAISE EXCEPTION 'No services provided';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE s.is_active = true),
    COALESCE(SUM(s.price * 100) FILTER (WHERE s.is_active = true), 0)::int,
    COALESCE(SUM(s.duration_minutes) FILTER (WHERE s.is_active = true), 0)::int
  INTO valid_service_count, total_price_cents, total_duration_minutes
  FROM services s
  WHERE s.id = ANY(p_service_ids);

  IF valid_service_count < service_count THEN
    RAISE EXCEPTION 'Invalid or inactive service in selection';
  END IF;

  IF total_price_cents = 0 THEN
    RAISE EXCEPTION 'No valid active services found for provided service_ids';
  END IF;

  -- 4) Generate receipt ID
  SELECT 
    'CS-' || 
    TO_CHAR(now(), 'YYYYMMDD') || '-' ||
    TO_CHAR(now(), 'HH24MISS') || '-' ||
    UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4))
  INTO receipt_id;

  -- 5) Calculate scheduled_end if we have duration
  IF total_duration_minutes > 0 THEN
    scheduled_end_calc := p_scheduled_start + (total_duration_minutes || ' minutes')::interval;
  ELSE
    scheduled_end_calc := NULL;
  END IF;

  -- 6) Calculate amounts
  service_price := (total_price_cents / 100.0)::numeric(10,2);
  subtotal := service_price + COALESCE(p_tax_amount, 0.00);
  
  -- Calculate Stripe fees based on subtotal (service + tax)
  stripe_fees := calculate_stripe_fees(subtotal);
  stripe_processing_fee := (stripe_fees->>'processing_fee')::numeric;
  stripe_connect_fee := (stripe_fees->>'connect_fee')::numeric;
  total_stripe_fees := stripe_processing_fee + stripe_connect_fee;
  
  -- Final total includes service + tax + Stripe fees
  final_total := subtotal + total_stripe_fees;

  -- 7) Insert into bookings
  INSERT INTO bookings (
    receipt_id,
    user_id,
    car_id,
    service_id,
    detailer_id,
    scheduled_date,
    scheduled_time_start,
    scheduled_time_end,
    scheduled_start,
    scheduled_end,
    address_line1,
    address_line2,
    city,
    province,
    postal_code,
    latitude,
    longitude,
    location_address,
    location_lat,
    location_lng,
    location_notes,
    status,
    payment_status,
    service_price,
    addons_total,
    tax_amount,
    stripe_processing_fee,
    stripe_connect_fee,
    total_amount,
    payment_method_id,
    created_at,
    updated_at
  )
  VALUES (
    receipt_id,
    current_user_id,
    p_car_id,
    p_service_ids[1],
    NULL,
    DATE(p_scheduled_start),
    p_scheduled_start::time,
    CASE WHEN scheduled_end_calc IS NOT NULL THEN scheduled_end_calc::time ELSE NULL END,
    p_scheduled_start,
    scheduled_end_calc,
    SPLIT_PART(p_location_address, ',', 1),
    NULL,
    p_city,
    p_province,
    p_postal_code,
    p_location_lat,
    p_location_lng,
    p_location_address,
    p_location_lat,
    p_location_lng,
    p_location_notes,
    'requires_payment'::booking_status_enum,
    'requires_payment'::payment_status_enum,
    service_price,
    0.00,
    COALESCE(p_tax_amount, 0.00),
    stripe_processing_fee,
    stripe_connect_fee,
    final_total,
    NULL,
    now(),
    now()
  )
  RETURNING id INTO new_booking_id;

  -- 8) Insert into booking_services
  INSERT INTO booking_services (booking_id, service_id, quantity)
  SELECT new_booking_id, sid, 1
  FROM unnest(p_service_ids) AS sid;

  -- 9) Return combined JSON
  RETURN jsonb_build_object(
    'booking', (
      SELECT to_jsonb(b.*)
      FROM bookings b
      WHERE b.id = new_booking_id
    ),
    'total_price_cents', total_price_cents,
    'total_duration_minutes', total_duration_minutes,
    'stripe_fees', stripe_fees,
    'services', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'price', s.price,
          'price_cents', (s.price * 100)::int,
          'duration_minutes', s.duration_minutes,
          'is_active', s.is_active,
          'display_order', s.display_order
        ) ORDER BY s.display_order
      )
      FROM services s
      WHERE s.id = ANY(p_service_ids)
        AND s.is_active = true
    )
  );
END;
$$;

COMMENT ON FUNCTION public.create_booking IS 
'Creates a booking transactionally. Validates car ownership and service validity. Calculates and includes Stripe fees (processing + Connect) in total_amount. Returns booking data with computed totals including Stripe fees.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Bookings now include Stripe fees in the total_amount:
-- - stripe_processing_fee: 2.9% + CA$0.30 (payment processing)
-- - stripe_connect_fee: 0.25% + $0.25 (Connect payout)
-- 
-- The customer pays: service_price + tax + stripe_processing_fee + stripe_connect_fee
-- The detailer receives: service_price - platform_fee (Stripe fees already covered by customer)
-- ============================================================================
