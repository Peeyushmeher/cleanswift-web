-- ============================================================================
-- Create update_booking_status RPC Function
-- ============================================================================
-- This function implements a central booking status state machine.
-- It enforces allowed state transitions based on user role and current status.
--
-- State Transition Rules:
-- ============================================================================
-- From               → To                    | Who can do it
-- ----------------------------------------------------------------------------
-- pending            → requires_payment      | system / create_booking
-- requires_payment   → paid                  | webhook only (on payment success)
-- requires_payment   → cancelled             | user/admin
-- paid               → offered               | system/admin
-- paid               → accepted              | detailer (via accept_booking)
-- offered            → accepted              | detailer (via accept_booking)
-- accepted           → in_progress           | detailer
-- in_progress        → completed             | detailer
-- paid               → cancelled             | user/admin
-- accepted           → cancelled             | admin
-- any non-final      → cancelled             | admin
-- any non-final      → no_show               | admin
--
-- Final states (generally cannot transition from):
-- - completed
-- - cancelled
-- - no_show
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_new_status booking_status_enum
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_role user_role_enum;
  current_status booking_status_enum;
  booking_user_id uuid;
  booking_detailer_id uuid;
  booking_payment_status payment_status_enum;
  allowed boolean := false;
  updated_booking bookings;
BEGIN
  -- 1) Authentication check (allow system calls for webhooks)
  current_user_id := auth.uid();
  
  -- If auth.uid() is null, this is a system call (e.g., webhook)
  -- System calls are allowed for specific transitions (e.g., requires_payment -> paid)
  IF current_user_id IS NULL THEN
    -- System call: only allow specific transitions
    -- This is used by webhooks and other system operations
    SELECT 
      status,
      user_id,
      detailer_id,
      payment_status
    INTO 
      current_status,
      booking_user_id,
      booking_detailer_id,
      booking_payment_status
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF current_status IS NULL THEN
      RAISE EXCEPTION 'Booking not found';
    END IF;

    -- System can transition: requires_payment -> paid (on payment success)
    IF current_status = 'requires_payment' AND p_new_status = 'paid' THEN
      UPDATE bookings
      SET 
        status = p_new_status,
        updated_at = now()
      WHERE id = p_booking_id
      RETURNING * INTO updated_booking;
      RETURN updated_booking;
    END IF;

    -- System can transition: pending -> requires_payment (on booking creation)
    IF current_status = 'pending' AND p_new_status = 'requires_payment' THEN
      UPDATE bookings
      SET 
        status = p_new_status,
        updated_at = now()
      WHERE id = p_booking_id
      RETURNING * INTO updated_booking;
      RETURN updated_booking;
    END IF;

    -- For other transitions, system calls are not allowed
    RAISE EXCEPTION 'System calls can only transition requires_payment->paid or pending->requires_payment';
  END IF;

  -- 2) Get user role from profiles (for authenticated users)
  SELECT role INTO current_role
  FROM profiles
  WHERE id = current_user_id;

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3) Fetch booking with row lock (prevents concurrent updates)
  SELECT 
    status,
    user_id,
    detailer_id,
    payment_status
  INTO 
    current_status,
    booking_user_id,
    booking_detailer_id,
    booking_payment_status
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 4) If status is already the requested status, allow (idempotent)
  IF current_status = p_new_status THEN
    SELECT * INTO updated_booking FROM bookings WHERE id = p_booking_id;
    RETURN updated_booking;
  END IF;

  -- 5) Define allowed transitions based on role
  IF current_role = 'user' THEN
    -- Users can only affect their own bookings
    IF booking_user_id <> current_user_id THEN
      RAISE EXCEPTION 'Cannot modify another user''s booking';
    END IF;

    -- Users can cancel bookings in certain states
    IF current_status = 'pending' AND p_new_status = 'cancelled' THEN
      allowed := true;
    ELSIF current_status = 'requires_payment' AND p_new_status = 'cancelled' THEN
      allowed := true;
    ELSIF current_status = 'paid' AND p_new_status = 'cancelled' THEN
      -- User can cancel paid booking before detailer assignment
      IF booking_detailer_id IS NULL THEN
        allowed := true;
      END IF;
    END IF;

  ELSIF current_role = 'detailer' THEN
    -- Detailers can only affect bookings assigned to them
    IF booking_detailer_id IS NULL OR booking_detailer_id <> current_user_id THEN
      RAISE EXCEPTION 'Detailer not assigned to this booking';
    END IF;

    -- Detailers can move through work states
    IF current_status = 'accepted' AND p_new_status = 'in_progress' THEN
      allowed := true;
    ELSIF current_status = 'in_progress' AND p_new_status = 'completed' THEN
      allowed := true;
    END IF;

  ELSIF current_role = 'admin' THEN
    -- Admins can do almost any transition (except from final states to non-final)
    -- Allow transitions from non-final states
    IF current_status NOT IN ('completed', 'cancelled', 'no_show') THEN
      allowed := true;
    ELSIF current_status = 'completed' AND p_new_status = 'completed' THEN
      -- Idempotent (already handled above, but keep for clarity)
      allowed := true;
    ELSIF current_status = 'cancelled' AND p_new_status = 'cancelled' THEN
      -- Idempotent
      allowed := true;
    ELSIF current_status = 'no_show' AND p_new_status = 'no_show' THEN
      -- Idempotent
      allowed := true;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown role: %', current_role;
  END IF;

  -- 6) Check if transition is allowed
  IF NOT allowed THEN
    RAISE EXCEPTION 'Transition from % to % is not allowed for role %',
      current_status, p_new_status, current_role;
  END IF;

  -- 7) Apply update
  UPDATE bookings
  SET 
    status = p_new_status,
    updated_at = now(),
    -- Set completed_at timestamp when status becomes 'completed'
    completed_at = CASE 
      WHEN p_new_status = 'completed' AND completed_at IS NULL THEN now()
      ELSE completed_at
    END
  WHERE id = p_booking_id
  RETURNING * INTO updated_booking;

  -- 8) Return updated booking
  RETURN updated_booking;
END;
$$;

COMMENT ON FUNCTION public.update_booking_status IS 
'Central booking status state machine. Enforces allowed state transitions based on user role and current status. Uses row locking to prevent race conditions.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_booking_status TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The update_booking_status function is now available for use.
-- It enforces:
-- - Authentication (uses auth.uid())
-- - Role-based permissions (user, detailer, admin)
-- - Allowed state transitions
-- - Row locking to prevent race conditions
-- - Automatic completed_at timestamp setting
-- ============================================================================

