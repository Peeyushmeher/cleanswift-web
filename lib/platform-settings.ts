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
 * Get the subscription platform fee percentage from the database
 * Returns the percentage as a number (e.g., 3 for 3%)
 * Defaults to 3 if not set
 */
export async function getSubscriptionPlatformFeePercentage(): Promise<number> {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'subscription_platform_fee_percentage')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching subscription platform fee percentage:', {
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return 3; // Default fallback
    }
    
    if (!data) {
      // Row doesn't exist, return default
      console.warn('Subscription platform fee percentage not found in database, using default 3%');
      return 3;
    }
    
    // Extract numeric value from JSONB
    // The value is stored as JSONB, so it might be a number or string
    let value: number;
    if (typeof data.value === 'number') {
      value = data.value;
    } else if (typeof data.value === 'string') {
      value = parseFloat(data.value) || 3;
    } else {
      // If it's JSONB, try to extract the numeric value
      const stringValue = JSON.stringify(data.value);
      value = parseFloat(stringValue) || 3;
    }
    
    return value;
  } catch (error) {
    console.error('Unexpected error fetching subscription platform fee percentage:', {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error)
    });
    return 3; // Default fallback
  }
}

/**
 * Calculate platform fee from a total amount
 * @param totalAmount - The total booking amount
 * @param feePercentage - Optional fee percentage (will fetch from DB if not provided)
 * @param detailerId - Optional detailer ID to check pricing model
 * @returns The platform fee amount
 */
export async function calculatePlatformFee(
  totalAmount: number,
  feePercentage?: number,
  detailerId?: string
): Promise<number> {
  let percentage: number;
  
  // If detailerId is provided, check their pricing model
  if (detailerId && !feePercentage) {
    const supabase = await createClient();
    try {
      const { data: detailer, error } = await supabase
        .from('detailers')
        .select('pricing_model')
        .eq('id', detailerId)
        .single();
      
      if (!error && detailer) {
        // If subscription model, use subscription fee (3%)
        // If percentage model or NULL, use standard fee (15%)
        if (detailer.pricing_model === 'subscription') {
          percentage = await getSubscriptionPlatformFeePercentage();
        } else {
          // percentage model or NULL (default to percentage)
          percentage = await getPlatformFeePercentage();
        }
      } else {
        // Error fetching detailer, default to standard fee
        percentage = await getPlatformFeePercentage();
      }
    } catch (error) {
      console.error('Error fetching detailer pricing model:', error);
      percentage = await getPlatformFeePercentage();
    }
  } else {
    // Use provided feePercentage or fetch standard fee
    percentage = feePercentage ?? await getPlatformFeePercentage();
  }
  
  return (totalAmount * percentage) / 100;
}

/**
 * Calculate detailer payout from a total amount
 * @param totalAmount - The total booking amount
 * @param feePercentage - Optional fee percentage (will fetch from DB if not provided)
 * @param detailerId - Optional detailer ID to check pricing model
 * @returns The detailer payout amount
 */
export async function calculateDetailerPayout(
  totalAmount: number,
  feePercentage?: number,
  detailerId?: string
): Promise<number> {
  const platformFee = await calculatePlatformFee(totalAmount, feePercentage, detailerId);
  return totalAmount - platformFee;
}
