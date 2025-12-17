import { formatCurrency } from '@/lib/detailer/dashboard-utils';

interface PaymentBreakdownProps {
  servicePrice: number;
  addonsTotal: number;
  taxAmount: number;
  totalAmount: number;
  tipAmount?: number;
  platformFee?: number;
  platformFeePercentage?: number;
  stripeProcessingFee?: number;
  stripeConnectFee?: number;
}

export default function PaymentBreakdown({
  servicePrice,
  addonsTotal,
  taxAmount,
  totalAmount,
  tipAmount = 0,
  platformFee,
  platformFeePercentage = 15,
  stripeProcessingFee = 0,
  stripeConnectFee = 0,
}: PaymentBreakdownProps) {
  // Calculate platform fee based on service price (not including Stripe fees)
  // Platform fee is calculated on the base service amount, not the total with fees
  const baseAmount = servicePrice + addonsTotal;
  const calculatedPlatformFee = platformFee ?? (baseAmount * platformFeePercentage) / 100;
  const payoutAmount = baseAmount - calculatedPlatformFee;
  
  // Calculate total Stripe fees
  const totalStripeFees = (stripeProcessingFee || 0) + (stripeConnectFee || 0);

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-white mb-4">Payment Breakdown</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-[#C6CFD9]">
          <span>Service Price:</span>
          <span className="text-white">{formatCurrency(servicePrice)}</span>
        </div>
        {addonsTotal > 0 && (
          <div className="flex justify-between text-[#C6CFD9]">
            <span>Add-ons:</span>
            <span className="text-white">{formatCurrency(addonsTotal)}</span>
          </div>
        )}
        {tipAmount > 0 && (
          <div className="flex justify-between text-[#C6CFD9]">
            <span>Tip:</span>
            <span className="text-white">{formatCurrency(tipAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[#C6CFD9]">
          <span>Tax:</span>
          <span className="text-white">{formatCurrency(taxAmount)}</span>
        </div>
        {totalStripeFees > 0 && (
          <>
            {stripeProcessingFee > 0 && (
              <div className="flex justify-between text-[#C6CFD9]">
                <span>Payment Processing Fee (2.9% + $0.30):</span>
                <span className="text-white">{formatCurrency(stripeProcessingFee)}</span>
              </div>
            )}
            {stripeConnectFee > 0 && (
              <div className="flex justify-between text-[#C6CFD9]">
                <span>Payout Fee (0.25% + $0.25):</span>
                <span className="text-white">{formatCurrency(stripeConnectFee)}</span>
              </div>
            )}
          </>
        )}
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="flex justify-between text-white font-semibold">
            <span>Total:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>
        {calculatedPlatformFee > 0 && (
          <>
            <div className="flex justify-between text-[#C6CFD9]">
              <span>Platform Fee ({platformFeePercentage}%):</span>
              <span className="text-white">{formatCurrency(calculatedPlatformFee)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex justify-between text-[#32CE7A] font-semibold">
                <span>Your Payout:</span>
                <span>{formatCurrency(payoutAmount)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

