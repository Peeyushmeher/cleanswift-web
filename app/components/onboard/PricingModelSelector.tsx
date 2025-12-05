'use client';

interface PricingModelSelectorProps {
  selected: 'subscription' | 'percentage' | null;
  onChange: (model: 'subscription' | 'percentage') => void;
  errors?: Partial<Record<string, string>>;
}

export default function PricingModelSelector({ selected, onChange, errors }: PricingModelSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          Choose Your Pricing Model <span className="text-red-400">*</span>
        </label>
        <p className="text-slate-400 text-sm mb-6">
          Select how you want to pay the platform. You can change this later in your settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option A: Monthly Subscription */}
        <label
          className={`relative flex flex-col p-6 rounded-lg border cursor-pointer transition-all ${
            selected === 'subscription'
              ? 'bg-cyan-500/10 border-cyan-500/50 ring-2 ring-cyan-500/20'
              : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
          }`}
        >
          <input
            type="radio"
            name="pricing_model"
            value="subscription"
            checked={selected === 'subscription'}
            onChange={() => onChange('subscription')}
            className="sr-only"
          />
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Monthly Subscription</h3>
              <div className="text-2xl font-bold text-cyan-400 mb-1">$29.99<span className="text-sm text-slate-400 font-normal">/month</span></div>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              selected === 'subscription'
                ? 'bg-cyan-500 border-cyan-500'
                : 'border-slate-600'
            }`}>
              {selected === 'subscription' && (
                <div className="w-3 h-3 rounded-full bg-white" />
              )}
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Fixed monthly cost - predictable expenses</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Only 3% platform fee per booking (for payment processing)</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Best for detailers with high booking volume</span>
            </li>
          </ul>
        </label>

        {/* Option B: Pay Per Booking */}
        <label
          className={`relative flex flex-col p-6 rounded-lg border cursor-pointer transition-all ${
            selected === 'percentage'
              ? 'bg-cyan-500/10 border-cyan-500/50 ring-2 ring-cyan-500/20'
              : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
          }`}
        >
          <input
            type="radio"
            name="pricing_model"
            value="percentage"
            checked={selected === 'percentage'}
            onChange={() => onChange('percentage')}
            className="sr-only"
          />
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Pay Per Booking</h3>
              <div className="text-2xl font-bold text-cyan-400 mb-1">15%<span className="text-sm text-slate-400 font-normal"> platform fee</span></div>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              selected === 'percentage'
                ? 'bg-cyan-500 border-cyan-500'
                : 'border-slate-600'
            }`}>
              {selected === 'percentage' && (
                <div className="w-3 h-3 rounded-full bg-white" />
              )}
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>No monthly subscription fee</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Pay only when you get bookings</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Best for detailers just starting out</span>
            </li>
          </ul>
        </label>
      </div>

      {errors?.pricing_model && (
        <p className="text-red-400 text-sm mt-1">{errors.pricing_model}</p>
      )}
    </div>
  );
}

