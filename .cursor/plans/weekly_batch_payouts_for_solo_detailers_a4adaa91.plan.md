---
name: Weekly Batch Payouts for Solo Detailers
overview: Implement weekly batch payouts for solo detailers to reduce Stripe Connect fees. Instead of processing individual transfers immediately, accumulate transfers and process them weekly on Wednesdays, covering the previous week (Monday-Sunday). This consolidates multiple bookings into a single payout per detailer, saving 0.25% + $0.25 per additional booking.
todos:
  - id: schema_migration
    content: Create database migration for solo_weekly_payout_batches table and add weekly_payout_batch_id to detailer_transfers
    status: pending
  - id: modify_transfer_function
    content: Modify process-detailer-transfer to only create pending records (remove immediate Stripe transfer)
    status: pending
    dependencies:
      - schema_migration
  - id: create_weekly_processor
    content: Create process-weekly-payouts Edge Function to batch transfers by detailer and create Stripe transfers
    status: pending
    dependencies:
      - schema_migration
  - id: update_webhook_handler
    content: Update handle-stripe-webhook to handle batch transfer events and update all related transfers
    status: pending
    dependencies:
      - create_weekly_processor
  - id: setup_weekly_cron
    content: Create weekly cron job (Wednesday 9 AM) to call process-weekly-payouts
    status: pending
    dependencies:
      - create_weekly_processor
  - id: update_earnings_ui
    content: Update earnings page to show pending weekly payouts and weekly payout history
    status: pending
    dependencies:
      - schema_migration
  - id: update_booking_detail_ui
    content: Update booking detail page to show weekly batch status instead of individual transfer status
    status: pending
    dependencies:
      - schema_migration
  - id: create_weekly_payout_component
    content: Create WeeklyPayoutSummary component to display pending weekly payout information
    status: pending
    dependencies:
      - schema_migration
---

# Weekly Batch Payouts Implementation Plan

## Overview

Currently, solo detailers receive individual Stripe Connect transfers immediately when bookings complete, incurring a fee of 0.25% + $0.25 per transfer. This plan implements weekly batch payouts that consolidate all transfers for a detailer into a single weekly payout, processed every Wednesday for the previous week (Monday-Sunday).

## Architecture Changes

### 1. Database Schema Updates

**New Table: `solo_weekly_payout_batches`**

- Track weekly payout batches for solo detailers (similar to `payout_batches` for organizations)
- Fields: `id`, `detailer_id`, `week_start_date` (Monday), `week_end_date` (Sunday), `total_amount_cents`, `total_transfers`, `stripe_transfer_id`, `status`, `processed_at`, `created_at`, `updated_at`
- Indexes on `detailer_id`, `week_start_date`, `status`

**Modify: `detailer_transfers` table**

- Add `weekly_payout_batch_id` column (nullable, references `solo_weekly_payout_batches`)
- This links individual transfers to their weekly batch
- Keep existing `status` field but change behavior: `pending` transfers accumulate until weekly batch

**Migration Strategy:**

- Existing `pending` transfers will be included in the next weekly batch
- `processing`/`succeeded` transfers remain unchanged

### 2. Edge Function Changes

**Modify: `process-detailer-transfer`** ([supabase/functions/process-detailer-transfer/index.ts](supabase/functions/process-detailer-transfer/index.ts))

- Remove immediate Stripe transfer creation
- Only create/update `detailer_transfers` record with status `pending`
- No Stripe API call - transfers accumulate until weekly batch

**New: `process-weekly-payouts`** Edge Function

- Runs weekly (Wednesday) via cron job
- Queries all `pending` transfers from previous week (Monday-Sunday)
- Groups by `detailer_id`
- For each detailer:
    - Calculate total amount (sum of all pending transfers)
    - Create `solo_weekly_payout_batches` record
    - Create single Stripe transfer for total amount
    - Update all related `detailer_transfers` records:
        - Set `weekly_payout_batch_id`
        - Set `status` to `processing`
        - Set `stripe_transfer_id` to the batch transfer ID
- Handle errors: mark batch as failed, keep transfers as `pending` for retry

**New: `retry-weekly-payouts`** Edge Function (optional)

- Retry failed weekly batches
- Process transfers that failed in previous batch attempts

### 3. Scheduled Jobs (pg_cron)

**New Weekly Cron Job:**

- Schedule: Every Wednesday at 9:00 AM (configurable)
- Calls: `process-weekly-payouts` Edge Function
- Query logic: Select transfers where `created_at` is between previous Monday 00:00 and Sunday 23:59:59

**Update Existing Jobs:**

- `process-pending-transfers`: Can be disabled or repurposed for emergency manual processing
- Keep `retry-failed-transfers` for handling failed individual transfers (if any remain)

### 4. Stripe Integration

**Stripe Transfer Changes:**

- Instead of one transfer per booking, create one transfer per detailer per week
- Transfer metadata should include:
    - `weekly_batch_id`: Reference to `solo_weekly_payout_batches.id`
    - `detailer_id`: Detailer receiving payout
    - `week_start`: Monday date
    - `week_end`: Sunday date
    - `transfer_count`: Number of bookings in batch

**Webhook Handling:**

- Update `handle-stripe-webhook` to handle batch transfer events
- When `transfer.paid` received:
    - Find `solo_weekly_payout_batches` by `stripe_transfer_id`
    - Update batch status to `succeeded`
    - Update all related `detailer_transfers` to `succeeded`
- When `transfer.failed` received:
    - Mark batch as `failed`
    - Mark all related transfers as `retry_pending`

### 5. UI/UX Updates

**Earnings Page** ([app/detailer/earnings/page.tsx](app/detailer/earnings/page.tsx))

- Show "Pending Weekly Payout" section:
    - Total amount pending for current week
    - Number of bookings included
    - Expected payout date (next Wednesday)
    - List of bookings in pending batch
- Show "Weekly Payout History" section:
    - Past weekly payouts with dates, amounts, status
    - Click to view details of bookings in each batch

**Booking Detail Page** ([app/detailer/bookings/[id]/BookingDetailClient.tsx](app/detailer/bookings/[id]/BookingDetailClient.tsx))

- Update transfer status display:
    - Show "Pending Weekly Batch" instead of "Pending Transfer"
    - Show which weekly batch it's part of (once batch is created)
    - Show expected payout date

**New Component: `WeeklyPayoutSummary.tsx`**

- Display pending weekly payout information
- Show breakdown of bookings in the batch
- Similar to existing `PayoutBatches.tsx` but for solo detailers

### 6. Data Flow

```
Booking Completed
    ↓
Create detailer_transfer (status: pending)
    ↓
[Accumulates until Wednesday]
    ↓
Weekly Cron Job (Wednesday 9 AM)
    ↓
process-weekly-payouts Edge Function
    ↓
Group transfers by detailer_id
    ↓
For each detailer:
 - Create solo_weekly_payout_batches record
 - Create single Stripe transfer (total amount)
 - Update all transfers: link to batch, status = processing
    ↓
Stripe Webhook: transfer.paid
    ↓
Update batch and all transfers: status = succeeded
```

### 7. Migration Considerations

**Existing Pending Transfers:**

- All existing `pending` transfers will be included in the first weekly batch
- No data loss - they'll just be processed together

**Backward Compatibility:**

- Keep `detailer_transfers` table structure mostly the same
- `weekly_payout_batch_id` is nullable (for any edge cases)
- Existing queries still work

**Testing Strategy:**

- Test with a few detailers first
- Verify batch creation and Stripe transfer
- Confirm webhook updates all related transfers
- Test error handling (failed transfers)

### 8. Configuration

**Platform Settings:**

- Add `weekly_payout_day` setting (default: Wednesday)
- Add `weekly_payout_time` setting (default: 09:00)
- Allow future customization of payout schedule

## Implementation Files

### New Files:

- `supabase/migrations/XXXXXX_add_weekly_payout_batches.sql` - Schema changes
- `supabase/functions/process-weekly-payouts/index.ts` - Weekly batch processor
- `components/detailer/WeeklyPayoutSummary.tsx` - UI component

### Modified Files:

- `supabase/functions/process-detailer-transfer/index.ts` - Remove immediate Stripe call
- `supabase/functions/handle-stripe-webhook/index.ts` - Handle batch transfer webhooks
- `app/detailer/earnings/page.tsx` - Show weekly payout info
- `app/detailer/bookings/[id]/BookingDetailClient.tsx` - Update transfer status display
- `supabase/migrations/XXXXXX_setup_weekly_payout_cron.sql` - Weekly cron job setup

## Benefits

1. **Cost Savings**: One fee per detailer per week instead of per booking

      - Example: 10 bookings/week = 10 fees → 1 fee (saves 9 × $0.25 = $2.25 + 0.25% savings)

2. **Simplified Accounting**: One payout per week per detailer
3. **Better Cash Flow**: Detailers receive consolidated weekly payments
4. **Scalability**: Reduces Stripe API calls and processing overhead

## Risks & Mitigation

1. **Failed Batch**: If weekly batch fails, all transfers remain `pending` and retry next week
2. **Large Batches**: Stripe has transfer limits - monitor batch sizes
3. **Detailer Expectations**: Communicate change from immediate to weekly payouts
4. **Edge Cases**: Handle detailers with no bookings in a week (skip batch creation)