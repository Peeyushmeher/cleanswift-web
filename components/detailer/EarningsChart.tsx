'use client';

interface EarningsData {
  date: string;
  amount: number;
}

interface EarningsChartProps {
  data: EarningsData[];
  period: 'day' | 'week' | 'month';
}

export default function EarningsChart({ data, period }: EarningsChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#C6CFD9]">
        No earnings data available
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount), 0);

  return (
    <div className="h-64 relative">
      <div className="absolute inset-0 flex items-end justify-between gap-1">
        {data.map((item, index) => {
          const height = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-[#32CE7A] rounded-t transition-all hover:bg-[#6FF0C4] relative group"
                style={{ height: `${height}%` }}
              >
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-[#0A1A2F] border border-white/5 rounded text-xs text-white opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  ${item.amount.toFixed(2)}
                </div>
              </div>
              <div className="text-xs text-[#C6CFD9] transform -rotate-45 origin-left whitespace-nowrap">
                {new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          );
        })}
      </div>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-[#C6CFD9]">
        <span>${maxAmount.toFixed(0)}</span>
        <span>${Math.floor(maxAmount / 2).toFixed(0)}</span>
        <span>$0</span>
      </div>
    </div>
  );
}

