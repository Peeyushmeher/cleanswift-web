-- ============================================================================
-- Add Transfer Initiation to update_booking_status Function
-- ============================================================================
-- This migration updates the update_booking_status function to automatically
-- create a transfer record when a booking status changes to 'completed' for
-- solo detailers with Stripe Connect accounts.
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
  v_user_id uuid;
  v_role user_role_enum;
  v_status booking_status_enum;
  v_booking_user_id uuid;
  v_detailer_id uuid;
  v_payment_status payment_status_enum;
  v_allowed boolean := false;
  v_booking bookings;
  v_role_text text;
  -- Variables for transfer initiation
  v_detailer_org_id uuid;
  v_detailer_stripe_account_id text;
  v_detailer_pricing_model text;
  v_booking_total_amount numeric;
  v_platform_fee_percentage numeric;
  v_platform_fee numeric;
  v_payout_amount numeric;
BEGIN
  -- 1) Authentication check (allow system calls for webhooks)
  v_user_id := auth.uid();
  
  -- If auth.uid() is null, this is a system call (e.g., webhook)
  -- System calls are allowed for specific transitions (e.g., requires_payment -> paid)
  IF v_user_id IS NULL THEN
    -- System call: only allow specific transitions
    -- This is used by webhooks and other system operations
    SELECT 
      status,
      user_id,
      detailer_id,
      payment_status
    INTO 
      v_status,
      v_booking_user_id,
      v_detailer_id,
      v_payment_status
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF v_status IS NULL THEN
      RAISE EXCEPTION 'Booking not found';
    END IF;

    -- System can transition: requires_payment -> paid (on payment success)
    IF v_status = 'requires_payment' AND p_new_status = 'paid' THEN
      UPDATE bookings
      SET 
        status = p_new_status,
        updated_at = now()
      WHERE id = p_booking_id
      RETURNING * INTO v_booking;
      RETURN v_booking;
    END IF;

    -- System can transition: pending -> requires_payment (on booking creation)
    IF v_status = 'pending' AND p_new_status = 'requires_payment' THEN
      UPDATE bookings
      SET 
        status = p_new_status,
        updated_at = now()
      WHERE id = p_booking_id
      RETURNING * INTO v_booking;
      RETURN v_booking;
    END IF;

    -- For other transitions, system calls are not allowed
    RAISE EXCEPTION 'System calls can only transition requires_payment->paid or pending->requires_payment';
  END IF;

  -- 2) Get user role from profiles (for authenticated users)
  -- Read role as text first to validate it, then cast safely
  SELECT role::text INTO v_role_text
  FROM profiles
  WHERE id = v_user_id;
  
  IF v_role_text IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Validate and set role - if invalid, default to 'user' and fix the profile
  IF v_role_text = 'user' THEN v_role := 'user';
  ELSIF v_role_text = 'detailer' THEN v_role := 'detailer';
  ELSIF v_role_text = 'admin' THEN v_role := 'admin';
  ELSE
    -- Invalid role value detected - log warning and fix it
    RAISE WARNING 'User % has invalid role: %. Fixing to user.', v_user_id, v_role_text;
    -- Fix the profile in the database
    UPDATE profiles
    SET role = 'user', updated_at = now()
    WHERE id = v_user_id;
    v_role := 'user';
  END IF;

  -- 3) Fetch booking with row lock (prevents concurrent updates)
  SELECT 
    status,
    user_id,
    detailer_id,
    payment_status,
    total_amount
  INTO 
    v_status,
    v_booking_user_id,
    v_detailer_id,
    v_payment_status,
    v_booking_total_amount
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 4) If status is already the requested status, allow (idempotent)
  IF v_status = p_new_status THEN
    SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
    RETURN v_booking;
  END IF;

  -- 5) Define allowed transitions based on role
  IF v_role = 'user' THEN
    -- Users can only affect their own bookings
    IF v_booking_user_id <> v_user_id THEN
      RAISE EXCEPTION 'Cannot modify another user''s booking';
    END IF;

    -- Users can cancel bookings in certain states (up to in_progress)
    -- Allow cancellation for: pending, requires_payment, paid, offered, accepted, in_progress
    -- Do NOT allow cancellation for: completed, cancelled, no_show (final states)
    IF p_new_status = 'cancelled' THEN
      IF v_status IN ('pending', 'requires_payment', 'paid', 'offered', 'accepted', 'in_progress') THEN
        v_allowed := true;
      END IF;
    END IF;

  ELSIF v_role = 'detailer' THEN
    -- Detailers can only affect bookings assigned to them
    IF v_detailer_id IS NULL OR v_detailer_id <> v_user_id THEN
      RAISE EXCEPTION 'Detailer not assigned to this booking';
    END IF;

    -- Detailers can move through work states
    IF v_status = 'accepted' AND p_new_status = 'in_progress' THEN
      v_allowed := true;
    ELSIF v_status = 'in_progress' AND p_new_status = 'completed' THEN
      v_allowed := true;
    END IF;

  ELSIF v_role = 'admin' THEN
    -- Admins can do almost any transition (except from final states to non-final)
    -- Allow transitions from non-final states
    IF v_status NOT IN ('completed', 'cancelled', 'no_show') THEN
      v_allowed := true;
    ELSIF (v_status IN ('completed', 'cancelled', 'no_show') AND v_status = p_new_status) THEN
      -- Idempotent
      v_allowed := true;
    END IF;

  ELSE
    -- This should never happen now due to validation above, but keep for safety
    RAISE EXCEPTION 'Unknown role: %', v_role;
  END IF;

  -- 6) Check if transition is allowed
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition from % to % is not allowed for role %',
      v_status, p_new_status, v_role;
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
  RETURNING * INTO v_booking;

  -- 8) Initiate transfer if booking is completed and detailer is solo
  IF p_new_status = 'completed' AND v_detailer_id IS NOT NULL THEN
    -- Check if detailer is solo and has Stripe Connect account
    SELECT 
      d.organization_id,
      d.stripe_connect_account_id,
      d.pricing_model
    INTO 
      v_detailer_org_id,
      v_detailer_stripe_account_id,
      v_detailer_pricing_model
    FROM detailers d
    WHERE d.id = v_detailer_id;

    -- Only process solo detailers (not organization members)
    IF v_detailer_org_id IS NULL AND v_detailer_stripe_account_id IS NOT NULL THEN
      -- Check if transfer already exists (prevent duplicates)
      IF NOT EXISTS (
        SELECT 1 FROM detailer_transfers WHERE booking_id = p_booking_id
      ) THEN
        -- Get platform fee percentage based on pricing model
        IF v_detailer_pricing_model = 'subscription' THEN
          -- Get subscription platform fee (default 3%)
          SELECT COALESCE(
            (SELECT 
              CASE 
                WHEN jsonb_typeof(value) = 'number' THEN (value::text)::numeric
                WHEN jsonb_typeof(value) = 'string' THEN (value::text)::numeric
                ELSE 3.00
              END
             FROM platform_settings 
             WHERE key = 'subscription_platform_fee_percentage' LIMIT 1),
            3.00
          ) INTO v_platform_fee_percentage;
        ELSE
          -- Get standard platform fee (default 15%)
          SELECT COALESCE(
            get_platform_fee_percentage(),
            15.00
          ) INTO v_platform_fee_percentage;
        END IF;

        -- Calculate amounts
        v_platform_fee := (v_booking_total_amount * v_platform_fee_percentage) / 100;
        v_payout_amount := v_booking_total_amount - v_platform_fee;

        -- Insert transfer record with pending status
        -- A scheduled job (process-pending-transfers) will process it
        INSERT INTO detailer_transfers (
          booking_id,
          detailer_id,
          amount_cents,
          platform_fee_cents,
          status
        ) VALUES (
          p_booking_id,
          v_detailer_id,
          ROUND(v_payout_amount * 100)::integer,
          ROUND(v_platform_fee * 100)::integer,
          'pending'
        );
        
        -- Note: Transfer will be processed by the process-pending-transfers scheduled job
        -- or can be triggered manually via the Edge Function API
      END IF;
    END IF;
  END IF;

  -- 9) Return updated booking
  RETURN v_booking;
END;
$$;

COMMENT ON FUNCTION public.update_booking_status IS 
'Central booking status state machine. Enforces allowed state transitions based on user role and current status. Uses row locking to prevent race conditions. Automatically initiates Stripe Connect transfers for solo detailers when bookings are completed.';

