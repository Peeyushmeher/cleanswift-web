---
name: Customer Payment Breakdown Component-90757f
overview: Create a customer-facing payment breakdown component that displays service price, tax (15%), Stripe processing fee (2.9% + $0.30), and Stripe Connect fee (0.25% + $0.25) before payment. This component will calculate fees client-side or accept pre-calculated values from the booking creation response.
todos: []
---

# Customer Payment Breakdown Component

## Overview

Create a reusable customer-facing payment breakdown component that displays all fees transparently before payment. This component will show the complete cost breakdown including service price, tax, and Stripe fees.

## IMPORTANT: Pre-Implementation Checks

**BEFORE implementing anything, verify the following:**

1. **Database Structure** - Check `bookings` table schema:

                                                                                                                                                                                                - Verify columns: `service_price`, `tax_amount`, `stripe_processing_fee`, `stripe_connect_fee`, `total_amount`
                                                                                                                                                                                                - Confirm fee calculation logic in `calculate_stripe_fees()` function
                                                                                                                                                                                                - Review `create_booking()` RPC function to understand fee calculation flow

2. **Existing Fee Calculations** - Review:

                                                                                                                                                                                                - `supabase/migrations/20251216000000_add_stripe_fees_to_bookings.sql` - Fee calculation logic
                                                                                                                                                                                                - `supabase/functions/create-payment-intent/index.ts` - How total_amount is used
                                                                                                                                                                                                - Any existing customer-facing booking components

3. **Tax Rate** - Verify:

                                                                                                                                                                                                - Check if tax rate is stored in database (service_areas table or platform_settings)
                                                                                                                                                                                                - Confirm if tax is calculated client-side or server-side
                                                                                                                                                                                                - Default to 15% if not found, but check database first

4. **Existing Components** - Review:

                                                                                                                                                                                                - `components/detailer/PaymentBreakdown.tsx` - For styling consistency
                                                                                                                                                                                                - Any existing customer booking flow pages
                                                                                                                                                                                                - Check if there's already a customer payment component

5. **Booking Creation Flow** - Understand:

                                                                                                                                                                                                - When fees are calculated (before or after booking creation)
                                                                                                                                                                                                - What data is returned from `create_booking()` RPC
                                                                                                                                                                                                - How `stripe_fees` JSON is structured in the response

**Only proceed with implementation after verifying these match the current system architecture.**

## Fee Structure

- **Tax**: 15% of service price (verify from database/service_areas)
- **Stripe Processing Fee**: 2.9% + CA$0.30 (calculated on: service_price + tax)
- **Stripe Connect Fee**: 0.25% + $0.25 (calculated on: service_price + tax)
- **Total**: service_price + tax + processing_fee + connect_fee

## Implementation

### 1. Create Customer Payment Breakdown Component

**File**: `components/customer/PaymentBreakdown.tsx`

Create a new component similar to the detailer PaymentBreakdown but without platform fee/payout information. The component should:

- Accept props:
                                                                                                                                - `servicePrice: number` - Base service price
                                                                                                                                - `addonsTotal?: number` - Optional add-ons (default 0)
                                                                                                                                - `taxRate?: number` - Tax rate percentage (default 15, but fetch from DB if available)
                                                                                                                                - `taxAmount?: number` - Pre-calculated tax (optional, will calculate if not provided)
                                                                                                                                - `stripeProcessingFee?: number` - Pre-calculated processing fee (optional)
                                                                                                                                - `stripeConnectFee?: number` - Pre-calculated connect fee (optional)
                                                                                                                                - `totalAmount?: number` - Pre-calculated total (optional)

- Display breakdown:

                                                                                                                                1. Service Price: `$X.XX`
                                                                                                                                2. Add-ons (if any): `$X.XX`
                                                                                                                                3. Tax (15%): `$X.XX`
                                                                                                                                4. Payment Processing Fee (2.9% + $0.30): `$X.XX`
                                                                                                                                5. Payout Fee (0.25% + $0.25): `$X.XX`
                                                                                                                                6. **Total**: `$X.XX` (bold, highlighted)

- Use the same styling as the detailer PaymentBreakdown component for consistency
- **Match the exact fee calculation logic from the database `calculate_stripe_fees()` function**

### 2. Fee Calculation Helper Function

**File**: `lib/utils/fee-calculations.ts`

Create a utility function that **exactly matches** the database `calculate_stripe_fees()` function:

```typescript
/**
 * Calculate Stripe fees - MUST match database calculate_stripe_fees() function
 * Database logic: (amount * 2.9 / 100) + 0.30 for processing, (amount * 0.25 / 100) + 0.25 for connect
 */
export function calculateStripeFees(subtotal: number): {
  processingFee: number;
  connectFee: number;
  totalFees: number;
} {
  // Match database calculation exactly
  const processingFee = (subtotal * 2.9 / 100) + 0.30;
  const connectFee = (subtotal * 0.25 / 100) + 0.25;
  
  // Round to 2 decimal places (match database ROUND function)
  return {
    processingFee: Math.round(processingFee * 100) / 100,
    connectFee: Math.round(connectFee * 100) / 100,
    totalFees: Math.round((processingFee + connectFee) * 100) / 100,
  };
}

/**
 * Calculate tax - verify tax rate from database/service_areas if available
 */
export function calculateTax(servicePrice: number, taxRate: number = 15): number {
  return Math.round((servicePrice * taxRate / 100) * 100) / 100;
}

/**
 * Calculate total amount - matches create_booking() RPC logic
 */
export function calculateTotalAmount(
  servicePrice: number,
  taxRate: number = 15,
  addonsTotal: number = 0
): {
  subtotal: number;
  taxAmount: number;
  processingFee: number;
  connectFee: number;
  totalAmount: number;
} {
  // Match database calculation: subtotal = service_price + tax
  const subtotal = servicePrice + addonsTotal;
  const taxAmount = calculateTax(subtotal, taxRate);
  const subtotalWithTax = subtotal + taxAmount;
  
  // Stripe fees calculated on subtotal (service + tax)
  const { processingFee, connectFee, totalFees } = calculateStripeFees(subtotalWithTax);
  const totalAmount = subtotalWithTax + totalFees;
  
  return {
    subtotal,
    taxAmount,
    processingFee,
    connectFee,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}
```

### 3. Integration Points

The component can be used in:

1. **Pre-booking summary** - Show estimated total before creating booking
2. **Booking confirmation screen** - Show final breakdown after booking creation (use values from `create_booking()` response)
3. **Payment page** - Show breakdown before customer enters payment details

**Important**: When booking is created via `create_booking()` RPC, use the returned `stripe_fees` JSON and booking data rather than recalculating to ensure consistency.

### 4. Usage Example

```tsx
import CustomerPaymentBreakdown from '@/components/customer/PaymentBreakdown';

// Option 1: Let component calculate fees (for pre-booking estimate)
<CustomerPaymentBreakdown 
  servicePrice={50.00}
  addonsTotal={10.00}
  taxRate={15}
/>

// Option 2: Use pre-calculated values from booking creation response (RECOMMENDED)
// This ensures exact match with database calculations
<CustomerPaymentBreakdown 
  servicePrice={booking.service_price}
  addonsTotal={booking.addons_total}
  taxAmount={booking.tax_amount}
  stripeProcessingFee={booking.stripe_processing_fee}
  stripeConnectFee={booking.stripe_connect_fee}
  totalAmount={booking.total_amount}
/>
```

## Design Notes

- Match the styling of existing PaymentBreakdown component
- Use same color scheme: `text-[#C6CFD9] `for labels, `text-white` for values
- Highlight total with `text-[#32CE7A] `(green) and `font-semibold`
- Add border separator before total
- Show fee percentages in labels for transparency: "Payment Processing Fee (2.9% + $0.30)"

## Files to Create/Modify

1. **NEW**: `components/customer/PaymentBreakdown.tsx` - Customer-facing payment breakdown component
2. **NEW**: `lib/utils/fee-calculations.ts` - Fee calculation utilities (must match database logic)
3. **MODIFY**: Any customer booking flow pages to integrate the component (location TBD based on your app structure)

## Testing Considerations

- Test with various service prices ($1, $50, $100, $500)
- **Verify fee calculations match backend `calculate_stripe_fees()` function exactly**
- Ensure tax calculation is correct (15% of service + addons, or from database)
- Test with and without add-ons
- Verify rounding to 2 decimal places matches database
- **Compare client-side calculations with actual booking creation response to ensure consistency**