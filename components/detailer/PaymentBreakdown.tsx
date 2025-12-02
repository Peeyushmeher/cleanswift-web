import { formatCurrency } from '@/lib/detailer/dashboard-utils';

interface PaymentBreakdownProps {
  servicePrice: number;
  addonsTotal: number;
  taxAmount: number;
  totalAmount: number;
  tipAmount?: number;
  platformFee?: number;
}

export default function PaymentBreakdown({
  servicePrice,
  addonsTotal,
  taxAmount,
  totalAmount,
  tipAmount = 0,
  platformFee,
}: PaymentBreakdownProps) {
  // Calculate platform fee if not provided (assume 10% for now)
  const calculatedPlatformFee = platformFee || totalAmount * 0.1;
  const payoutAmount = totalAmount - calculatedPlatformFee;

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
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="flex justify-between text-white font-semibold">
            <span>Total:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>
        {calculatedPlatformFee > 0 && (
          <>
            <div className="flex justify-between text-[#C6CFD9]">
              <span>Platform Fee (10%):</span>
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

