-- ============================================================================
-- Delete All Test Bookings
-- ============================================================================
-- This migration deletes all bookings and all related data.
-- Since all related tables have ON DELETE CASCADE, deleting bookings will
-- automatically delete:
--   - booking_addons
--   - booking_services
--   - reviews
--   - payments
--   - booking_timeline
--   - job_photos
--   - detailer_transfers
-- ============================================================================

-- Delete all bookings (cascades to all related tables)
DELETE FROM bookings;

-- Verify deletion (optional - can be removed after testing)
DO $$
DECLARE
  booking_count integer;
  addon_count integer;
  service_count integer;
  review_count integer;
  payment_count integer;
  timeline_count integer;
  photo_count integer;
  transfer_count integer;
BEGIN
  SELECT COUNT(*) INTO booking_count FROM bookings;
  SELECT COUNT(*) INTO addon_count FROM booking_addons;
  SELECT COUNT(*) INTO service_count FROM booking_services;
  SELECT COUNT(*) INTO review_count FROM reviews;
  SELECT COUNT(*) INTO payment_count FROM payments;
  SELECT COUNT(*) INTO timeline_count FROM booking_timeline;
  SELECT COUNT(*) INTO photo_count FROM job_photos;
  SELECT COUNT(*) INTO transfer_count FROM detailer_transfers;
  
  RAISE NOTICE 'Deletion complete. Remaining records:';
  RAISE NOTICE '  Bookings: %', booking_count;
  RAISE NOTICE '  Booking Addons: %', addon_count;
  RAISE NOTICE '  Booking Services: %', service_count;
  RAISE NOTICE '  Reviews: %', review_count;
  RAISE NOTICE '  Payments: %', payment_count;
  RAISE NOTICE '  Booking Timeline: %', timeline_count;
  RAISE NOTICE '  Job Photos: %', photo_count;
  RAISE NOTICE '  Detailer Transfers: %', transfer_count;
END
$$;

