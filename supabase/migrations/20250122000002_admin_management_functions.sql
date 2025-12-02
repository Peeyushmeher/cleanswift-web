-- ============================================================================
-- Admin Management Functions
-- ============================================================================
-- This migration creates RPC functions for admin dashboard functionality.
-- These functions allow admins to:
-- 1. View all bookings with filters
-- 2. View all users with role filters
-- 3. View all detailers
-- 4. Manually assign detailers to bookings
-- 5. Update user roles
-- 6. Get dashboard statistics
--
-- All functions require admin role and use SECURITY DEFINER to bypass RLS.
-- ============================================================================

-- ============================================================================
-- Function: get_all_bookings
-- ============================================================================
-- Returns all bookings with optional filters for admin dashboard.
-- Only accessible by admins.
--
-- Parameters:
--   p_status_filter - Optional booking status filter (booking_status_enum)
--   p_date_from - Optional start date filter
--   p_date_to - Optional end date filter
--   p_limit - Optional limit (default 100)
--   p_offset - Optional offset for pagination (default 0)
--
-- Returns: JSON array of bookings with related data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_bookings(
  p_status_filter booking_status_enum DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  result jsonb;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Verify admin role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can access all bookings';
  END IF;

  -- 3) Build query with filters
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'receipt_id', b.receipt_id,
      'status', b.status,
      'payment_status', b.payment_status,
      'scheduled_date', b.scheduled_date,
      'scheduled_time_start', b.scheduled_time_start,
      'scheduled_time_end', b.scheduled_time_end,
      'total_amount', b.total_amount,
      'created_at', b.created_at,
      'user', jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'phone', p.phone
      ),
      'detailer', CASE 
        WHEN b.detailer_id IS NOT NULL THEN
          jsonb_build_object(
            'id', d.id,
            'full_name', d.full_name,
            'rating', d.rating
          )
        ELSE NULL
      END,
      'service', jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'price', s.price
      ),
      'car', jsonb_build_object(
        'id', c.id,
        'make', c.make,
        'model', c.model,
        'year', c.year,
        'license_plate', c.license_plate
      ),
      'address', jsonb_build_object(
        'address_line1', b.address_line1,
        'city', b.city,
        'province', b.province,
        'postal_code', b.postal_code
      )
    )
  ) INTO result
  FROM bookings b
  LEFT JOIN profiles p ON p.id = b.user_id
  LEFT JOIN detailers d ON d.id = b.detailer_id
  LEFT JOIN services s ON s.id = b.service_id
  LEFT JOIN cars c ON c.id = b.car_id
  WHERE 
    (p_status_filter IS NULL OR b.status = p_status_filter)
    AND (p_date_from IS NULL OR b.scheduled_date >= p_date_from)
    AND (p_date_to IS NULL OR b.scheduled_date <= p_date_to)
  ORDER BY b.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;

  -- 4) Return result (empty array if no bookings)
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_all_bookings IS 
'Returns all bookings with optional filters. Admin only. Returns JSON array of bookings with related user, detailer, service, and car data.';

-- ============================================================================
-- Function: get_all_users
-- ============================================================================
-- Returns all user profiles with optional role filter.
-- Only accessible by admins.
--
-- Parameters:
--   p_role_filter - Optional role filter (user_role_enum)
--   p_limit - Optional limit (default 100)
--   p_offset - Optional offset for pagination (default 0)
--
-- Returns: JSON array of user profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_users(
  p_role_filter user_role_enum DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  result jsonb;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Verify admin role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can access all users';
  END IF;

  -- 3) Build query with filters
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'role', p.role,
      'avatar_url', p.avatar_url,
      'created_at', p.created_at,
      'booking_count', (
        SELECT COUNT(*)::integer
        FROM bookings b
        WHERE b.user_id = p.id
      )
    )
  ) INTO result
  FROM profiles p
  WHERE (p_role_filter IS NULL OR p.role = p_role_filter)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;

  -- 4) Return result (empty array if no users)
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_all_users IS 
'Returns all user profiles with optional role filter. Admin only. Returns JSON array of profiles with booking counts.';

-- ============================================================================
-- Function: get_all_detailers
-- ============================================================================
-- Returns all detailers with their linked profile information.
-- Only accessible by admins.
--
-- Returns: JSON array of detailers with profile data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_detailers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  result jsonb;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Verify admin role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can access all detailers';
  END IF;

  -- 3) Build query
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'full_name', d.full_name,
      'avatar_url', d.avatar_url,
      'rating', d.rating,
      'review_count', d.review_count,
      'years_experience', d.years_experience,
      'is_active', d.is_active,
      'created_at', d.created_at,
      'profile', jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'phone', p.phone
      ),
      'booking_count', (
        SELECT COUNT(*)::integer
        FROM bookings b
        WHERE b.detailer_id = d.id
      ),
      'completed_count', (
        SELECT COUNT(*)::integer
        FROM bookings b
        WHERE b.detailer_id = d.id
          AND b.status = 'completed'
      )
    )
  ) INTO result
  FROM detailers d
  LEFT JOIN profiles p ON p.id = d.profile_id
  ORDER BY d.created_at DESC;

  -- 4) Return result (empty array if no detailers)
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_all_detailers IS 
'Returns all detailers with linked profile information and booking statistics. Admin only.';

-- ============================================================================
-- Function: assign_detailer_to_booking
-- ============================================================================
-- Allows admin to manually assign a detailer to a booking.
-- Only accessible by admins.
--
-- Parameters:
--   p_booking_id - The booking ID
--   p_detailer_id - The detailer ID to assign
--
-- Returns: The updated booking
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_detailer_to_booking(
  p_booking_id uuid,
  p_detailer_id uuid
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  booking_record bookings;
  detailer_record detailers;
  updated_booking bookings;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Verify admin role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can assign detailers to bookings';
  END IF;

  -- 3) Validate booking exists
  SELECT * INTO booking_record
  FROM bookings
  WHERE id = p_booking_id;

  IF booking_record IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 4) Validate detailer exists and is active
  SELECT * INTO detailer_record
  FROM detailers
  WHERE id = p_detailer_id
    AND is_active = true;

  IF detailer_record IS NULL THEN
    RAISE EXCEPTION 'Detailer not found or inactive';
  END IF;

  -- 5) Update booking
  UPDATE bookings
  SET
    detailer_id = p_detailer_id,
    status = CASE 
      WHEN status IN ('paid', 'offered') THEN 'accepted'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO updated_booking;

  -- 6) Return updated booking
  RETURN updated_booking;
END;
$$;

COMMENT ON FUNCTION public.assign_detailer_to_booking IS 
'Allows admin to manually assign a detailer to a booking. Updates booking status to "accepted" if booking is "paid" or "offered". Admin only.';

-- ============================================================================
-- Function: update_user_role
-- ============================================================================
-- Allows admin to update a user's role.
-- Only accessible by admins.
--
-- Parameters:
--   p_user_id - The user profile ID
--   p_new_role - The new role (user_role_enum)
--
-- Returns: The updated profile
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id uuid,
  p_new_role user_role_enum
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  updated_profile profiles;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Verify admin role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  -- 3) Validate user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- 4) Prevent changing admin role (safety check)
  IF p_user_id = current_user_id AND p_new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot remove admin role from yourself';
  END IF;

  -- 5) Update role
  UPDATE profiles
  SET
    role = p_new_role,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO updated_profile;

  -- 6) Return updated profile
  RETURN updated_profile;
END;
$$;

COMMENT ON FUNCTION public.update_user_role IS 
'Allows admin to update a user''s role. Admin only. Prevents admins from removing their own admin role.';

-- ============================================================================
-- Function: get_dashboard_stats
-- ============================================================================
-- Returns dashboard statistics for admin view.
-- Only accessible by admins.
--
-- Returns: JSON object with statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  result jsonb;
BEGIN
  -- 1) Authentication check
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2) Verify admin role
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can access dashboard stats';
  END IF;

  -- 3) Build statistics
  SELECT jsonb_build_object(
    'total_bookings', (
      SELECT COUNT(*)::integer
      FROM bookings
    ),
    'pending_bookings', (
      SELECT COUNT(*)::integer
      FROM bookings
      WHERE status IN ('pending', 'requires_payment')
    ),
    'active_bookings', (
      SELECT COUNT(*)::integer
      FROM bookings
      WHERE status IN ('paid', 'offered', 'accepted', 'in_progress')
    ),
    'completed_bookings', (
      SELECT COUNT(*)::integer
      FROM bookings
      WHERE status = 'completed'
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(total_amount), 0)::numeric(10,2)
      FROM bookings
      WHERE payment_status = 'paid'
    ),
    'total_users', (
      SELECT COUNT(*)::integer
      FROM profiles
      WHERE role = 'user'
    ),
    'total_detailers', (
      SELECT COUNT(*)::integer
      FROM detailers
      WHERE is_active = true
    ),
    'active_detailers', (
      SELECT COUNT(DISTINCT detailer_id)::integer
      FROM bookings
      WHERE detailer_id IS NOT NULL
        AND status IN ('accepted', 'in_progress')
    ),
    'bookings_today', (
      SELECT COUNT(*)::integer
      FROM bookings
      WHERE scheduled_date = CURRENT_DATE
    ),
    'bookings_this_week', (
      SELECT COUNT(*)::integer
      FROM bookings
      WHERE scheduled_date >= DATE_TRUNC('week', CURRENT_DATE)
        AND scheduled_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
    ),
    'bookings_this_month', (
      SELECT COUNT(*)::integer
      FROM bookings
      WHERE scheduled_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND scheduled_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    )
  ) INTO result;

  -- 4) Return result
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats IS 
'Returns dashboard statistics including booking counts, revenue, user counts, and time-based metrics. Admin only.';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_all_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_detailers TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_detailer_to_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Admin management functions are now available:
-- 1. get_all_bookings - View all bookings with filters
-- 2. get_all_users - View all users with role filter
-- 3. get_all_detailers - View all detailers with stats
-- 4. assign_detailer_to_booking - Manually assign detailers
-- 5. update_user_role - Change user roles
-- 6. get_dashboard_stats - Dashboard analytics
-- ============================================================================

