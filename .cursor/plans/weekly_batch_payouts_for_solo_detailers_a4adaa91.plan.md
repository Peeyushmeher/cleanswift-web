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

- **Current behavior:** Called by `process-pending-transfers` cron job, immediately creates Stripe transfer
- **New behavior:** 
        - Remove immediate Stripe transfer creation (lines 354-392)
        - Only create/update `detailer_transfers` record with status `pending`
        - No Stripe API call - transfers accumulate until weekly batch
        - Function can still be called manually for edge cases, but won't create Stripe transfers
        - Note: This function may not be called at all after migration (bookings create transfers directly via SQL trigger)

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

### 6. Data Flow Comparison

**BEFORE (Current System - Immediate Transfers):**

```
Booking Completed
    ↓
update_booking_status() creates detailer_transfer (status: pending)
    ↓
[Wait up to 5 minutes]
    ↓
process-pending-transfers cron job (every 5 min)
    ↓
Calls process-detailer-transfer for each pending transfer
    ↓
process-detailer-transfer:
 - Creates Stripe transfer immediately
 - Updates status to 'processing'
 - Sets stripe_transfer_id
    ↓
[Stripe processes transfer]
    ↓
Stripe Webhook: transfer.paid
    ↓
Update transfer: status = 'succeeded'
    
Result: One Stripe transfer per booking = One fee per booking
```

**AFTER (New System - Weekly Batches):**

```
Booking Completed
    ↓
update_booking_status() creates detailer_transfer (status: pending)
    ↓
[Accumulates - NO immediate Stripe call]
    ↓
[More bookings complete, all accumulate as 'pending']
    ↓
Weekly Cron Job (Wednesday 9 AM)
    ↓
process-weekly-payouts Edge Function
    ↓
Query all 'pending' transfers from previous week (Mon-Sun)
    ↓
Group by detailer_id
    ↓
For each detailer:
 - Sum all pending amounts
 - Create solo_weekly_payout_batches record
 - Create SINGLE Stripe transfer (total amount)
 - Update all related transfers:
  * Set weekly_payout_batch_id
  * Set status = 'processing'
  * Set stripe_transfer_id (same for all in batch)
    ↓
[Stripe processes batch transfer]
    ↓
Stripe Webhook: transfer.paid
    ↓
Update batch: status = 'succeeded'
    ↓
Update ALL related transfers: status = 'succeeded'
    
Result: One Stripe transfer per detailer per week = One fee per detailer per week
```

### 7. Current System & Transition Strategy

**Current System Behavior:**

1. **Booking Completion Flow:**

            - When booking status changes to `completed`, `update_booking_status()` SQL function creates a `detailer_transfers` record with status `pending`
            - This happens immediately in the database trigger

2. **Immediate Transfer Processing:**

            - `process-pending-transfers` cron job runs every 5 minutes
            - It calls `process-detailer-transfer` Edge Function for each `pending` transfer
            - `process-detailer-transfer` immediately:
                    - Creates a Stripe transfer via Stripe API
                    - Updates transfer status to `processing`
                    - Sets `stripe_transfer_id`
            - Webhook later updates status to `succeeded`

**What Changes:**

1. **`process-detailer-transfer` Function:**

            - **BEFORE:** Creates Stripe transfer immediately, updates status to `processing`
            - **AFTER:** Only creates/updates `detailer_transfers` record with status `pending`, NO Stripe API call
            - Transfers accumulate in `pending` status until weekly batch

2. **`process-pending-transfers` Cron Job:**

            - **BEFORE:** Runs every 5 minutes, processes individual transfers immediately
            - **AFTER:** Disabled or repurposed (only for emergency manual processing)
            - Weekly batch job replaces this

3. **New Weekly Batch System:**

            - `process-weekly-payouts` runs every Wednesday
            - Groups all `pending` transfers by detailer
            - Creates one Stripe transfer per detailer per week

**Step-by-Step Migration Process:**

1. **Phase 1: Deploy Schema Changes (No Breaking Changes)**

            - Add `solo_weekly_payout_batches` table
            - Add `weekly_payout_batch_id` column to `detailer_transfers` (nullable)
            - Existing system continues working normally
            - All existing `processing`/`succeeded` transfers remain unchanged

2. **Phase 2: Deploy Modified `process-detailer-transfer`**

            - Update function to NOT create Stripe transfers
            - Only creates/updates `detailer_transfers` with `pending` status
            - New bookings will accumulate as `pending`
            - **Important:** Existing `processing` transfers continue to be handled by webhooks

3. **Phase 3: Deploy Weekly Batch System**

            - Deploy `process-weekly-payouts` Edge Function
            - Set up weekly cron job (Wednesday 9 AM)
            - Test with a small subset first

4. **Phase 4: Disable Old System**

            - **After confirming weekly batches work:**
            - Disable `process-pending-transfers` cron job (unschedule it)
            - Keep `retry-failed-transfers` for any edge cases
            - Monitor for any `pending` transfers that should have been processed

5. **Phase 5: Cleanup**

            - Any remaining `pending` transfers from before migration will be included in next weekly batch
            - No data loss - they'll just be batched together

**Handling In-Flight Transfers:**

- **Transfers already `processing`:** Continue to be handled by existing webhook system
- **Transfers already `succeeded`:** Remain unchanged, no action needed
- **Transfers `pending` at migration time:** Will be included in first weekly batch
- **Transfers `failed`:** Can be retried via `retry-failed-transfers` or included in weekly batch

**Rollback Plan:**

- If issues arise, can temporarily re-enable `process-pending-transfers` cron job
- Modified `process-detailer-transfer` can be reverted to create immediate transfers
- `weekly_payout_batch_id` is nullable, so old system queries still work

**Testing Strategy:**

1. Test with test detailer account first
2. Create test bookings, verify transfers accumulate as `pending`
3. Manually trigger `process-weekly-payouts` to test batch creation
4. Verify Stripe transfer is created correctly
5. Verify webhook updates all related transfers
6. Test error handling (failed batches)
7. Once confirmed, disable old cron job

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