import { createClient } from '@/lib/supabase/server';

/**
 * Get the platform fee percentage from the database
 * Returns the percentage as a number (e.g., 15 for 15%)
 * Defaults to 15 if not set
 */
export async function getPlatformFeePercentage(): Promise<number> {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.rpc('get_platform_fee_percentage');
    
    if (error) {
      console.error('Error fetching platform fee percentage:', error);
      return 15; // Default fallback
    }
    
    return parseFloat(data) || 15;
  } catch (error) {
    console.error('Error fetching platform fee percentage:', error);
    return 15; // Default fallback
  }
}

/**
 * Calculate platform fee from a total amount
 * @param totalAmount - The total booking amount
 * @param feePercentage - Optional fee percentage (will fetch from DB if not provided)
 * @returns The platform fee amount
 */
export async function calculatePlatformFee(
  totalAmount: number,
  feePercentage?: number
): Promise<number> {
  const percentage = feePercentage ?? await getPlatformFeePercentage();
  return (totalAmount * percentage) / 100;
}

/**
 * Calculate detailer payout from a total amount
 * @param totalAmount - The total booking amount
 * @param feePercentage - Optional fee percentage (will fetch from DB if not provided)
 * @returns The detailer payout amount
 */
export async function calculateDetailerPayout(
  totalAmount: number,
  feePercentage?: number
): Promise<number> {
  const platformFee = await calculatePlatformFee(totalAmount, feePercentage);
  return totalAmount - platformFee;
}
