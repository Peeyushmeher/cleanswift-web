-- ============================================================================
-- Fix create_booking RPC to use correct booking_status_enum value
-- ============================================================================
-- This migration ensures the create_booking function uses 'requires_payment'
-- instead of the old 'scheduled' value, which is not in booking_status_enum.
-- ============================================================================

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
  p_location_notes text DEFAULT NULL
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
  service_record record;
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
  -- Count how many service IDs were provided
  service_count := array_length(p_service_ids, 1);
  IF service_count IS NULL OR service_count = 0 THEN
    RAISE EXCEPTION 'No services provided';
  END IF;

  -- Validate all services exist and are active, and compute totals
  SELECT
    COUNT(*) FILTER (WHERE s.is_active = true),
    COALESCE(SUM(s.price * 100) FILTER (WHERE s.is_active = true), 0)::int,
    COALESCE(SUM(s.duration_minutes) FILTER (WHERE s.is_active = true), 0)::int
  INTO valid_service_count, total_price_cents, total_duration_minutes
  FROM services s
  WHERE s.id = ANY(p_service_ids);

  -- Check if all provided services were found and active
  IF valid_service_count < service_count THEN
    RAISE EXCEPTION 'Invalid or inactive service in selection';
  END IF;

  IF total_price_cents = 0 THEN
    RAISE EXCEPTION 'No valid active services found for provided service_ids';
  END IF;

  -- 4) Generate receipt ID (format: CS-YYYYMMDD-HHMMSS-RANDOM)
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

  -- 6) Insert into bookings
  -- Note: We populate both old columns (for backward compatibility) and new columns
  INSERT INTO bookings (
    receipt_id,
    user_id,
    car_id,
    service_id,  -- Old column: use first service for backward compatibility
    detailer_id,  -- Will be null initially
    scheduled_date,  -- Old column: extract date from scheduled_start
    scheduled_time_start,  -- Old column: extract time from scheduled_start
    scheduled_time_end,  -- Old column: extract time from scheduled_end if available
    scheduled_start,  -- New column
    scheduled_end,  -- New column
    address_line1,  -- Old column: extract from location_address
    address_line2,  -- Old column: will be null
    city,  -- Old column: required (NOT NULL)
    province,  -- Old column: required (NOT NULL)
    postal_code,  -- Old column: required (NOT NULL)
    latitude,  -- Old column: alias for location_lat
    longitude,  -- Old column: alias for location_lng
    location_address,  -- New column
    location_lat,  -- New column
    location_lng,  -- New column
    location_notes,  -- Old column
    status,  -- Uses booking_status_enum: 'requires_payment' (valid enum values: pending, requires_payment, paid, offered, accepted, in_progress, completed, cancelled, no_show)
    payment_status,  -- New column: use 'requires_payment'
    service_price,  -- Old column: will be calculated from services
    addons_total,  -- Old column: 0 for now
    tax_amount,  -- Old column: 0 for now (tax calculated client-side)
    total_amount,  -- Old column: will be calculated from services
    payment_method_id,  -- Old column: null initially
    created_at,
    updated_at
  )
  VALUES (
    receipt_id,
    current_user_id,
    p_car_id,
    p_service_ids[1],  -- First service for backward compatibility
    NULL,  -- detailer_id assigned later
    DATE(p_scheduled_start),  -- Extract date
    p_scheduled_start::time,  -- Extract time
    CASE WHEN scheduled_end_calc IS NOT NULL THEN scheduled_end_calc::time ELSE NULL END,
    p_scheduled_start,
    scheduled_end_calc,
    SPLIT_PART(p_location_address, ',', 1),  -- Extract first part as address_line1
    NULL,  -- address_line2
    p_city,  -- Use provided city (required)
    p_province,  -- Use provided province (required)
    p_postal_code,  -- Use provided postal_code (required)
    p_location_lat,
    p_location_lng,
    p_location_address,
    p_location_lat,
    p_location_lng,
    p_location_notes,
    'requires_payment'::booking_status_enum,  -- Explicitly cast to enum type
    'requires_payment'::payment_status_enum,  -- Explicitly cast to enum type
    (total_price_cents / 100.0)::numeric(10,2),  -- Convert cents to dollars
    0.00,  -- addons_total
    0.00,  -- tax_amount (calculated client-side)
    (total_price_cents / 100.0)::numeric(10,2),  -- total_amount (before tax)
    NULL,  -- payment_method_id
    now(),
    now()
  )
  RETURNING id INTO new_booking_id;

  -- 7) Insert into booking_services
  INSERT INTO booking_services (booking_id, service_id, quantity)
  SELECT new_booking_id, sid, 1
  FROM unnest(p_service_ids) AS sid;

  -- 8) Return combined JSON
  RETURN jsonb_build_object(
    'booking', (
      SELECT to_jsonb(b.*)
      FROM bookings b
      WHERE b.id = new_booking_id
    ),
    'total_price_cents', total_price_cents,
    'total_duration_minutes', total_duration_minutes,
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

COMMENT ON FUNCTION public.create_booking IS 'Creates a booking transactionally. Validates car ownership and service validity. Returns booking data with computed totals. Requires city, province, and postal_code as separate parameters. Uses booking_status_enum and payment_status_enum.';

-- ============================================================================
-- Grant execute permission to authenticated users
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.create_booking TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The create_booking RPC function has been updated to use the correct
-- booking_status_enum value ('requires_payment') instead of the old 'scheduled'
-- value. The function now explicitly casts enum values to ensure type safety.
-- ============================================================================

