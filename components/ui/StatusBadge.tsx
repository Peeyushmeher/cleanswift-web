import { getStatusColor } from '@/lib/detailer/dashboard-utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colorClass = getStatusColor(status);
  
  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full border ${colorClass} ${className}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

