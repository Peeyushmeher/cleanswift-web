'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface BookingsFiltersProps {
  cities: string[];
}

const paymentStatusOptions = [
  { value: '', label: 'All Payment' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

export default function BookingsFilters({ cities }: BookingsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildFilterUrl = (params: Record<string, string>) => {
    const current = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    });
    
    return `/admin/bookings?${current.toString()}`;
  };

  return (
    <>
      {/* Payment Status */}
      <select
        value={searchParams.get('payment_status') || ''}
        onChange={(e) => {
          router.push(buildFilterUrl({ payment_status: e.target.value, page: '1' }));
        }}
        className="px-3 py-1.5 rounded-lg text-sm bg-[#050B12] text-[#C6CFD9] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
      >
        {paymentStatusOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {/* City Filter */}
      <select
        value={searchParams.get('city') || ''}
        onChange={(e) => {
          router.push(buildFilterUrl({ city: e.target.value, page: '1' }));
        }}
        className="px-3 py-1.5 rounded-lg text-sm bg-[#050B12] text-[#C6CFD9] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
      >
        <option value="">All Cities</option>
        {cities.map((city) => (
          <option key={city} value={city}>{city}</option>
        ))}
      </select>

      {/* Date From */}
      <input
        type="date"
        value={searchParams.get('date_from') || ''}
        onChange={(e) => {
          router.push(buildFilterUrl({ date_from: e.target.value, page: '1' }));
        }}
        className="px-3 py-1.5 rounded-lg text-sm bg-[#050B12] text-[#C6CFD9] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
      />

      {/* Date To */}
      <input
        type="date"
        value={searchParams.get('date_to') || ''}
        onChange={(e) => {
          router.push(buildFilterUrl({ date_to: e.target.value, page: '1' }));
        }}
        className="px-3 py-1.5 rounded-lg text-sm bg-[#050B12] text-[#C6CFD9] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#32CE7A]/50"
      />
    </>
  );
}
