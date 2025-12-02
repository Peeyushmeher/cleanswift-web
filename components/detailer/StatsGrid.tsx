interface StatCard {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'default' | 'success' | 'warning';
}

interface StatsGridProps {
  stats: StatCard[];
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const getColorClasses = (color: StatCard['color']) => {
    switch (color) {
      case 'success':
        return 'text-[#32CE7A]';
      case 'warning':
        return 'text-yellow-400';
      default:
        return 'text-white';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-[#0A1A2F] border border-white/5 rounded-xl p-6"
        >
          <div className="text-[#C6CFD9] text-sm mb-2">{stat.label}</div>
          <div className={`text-3xl font-bold ${getColorClasses(stat.color)}`}>
            {stat.value}
          </div>
          {stat.subtitle && (
            <div className="text-xs text-[#C6CFD9] mt-1">{stat.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
}

