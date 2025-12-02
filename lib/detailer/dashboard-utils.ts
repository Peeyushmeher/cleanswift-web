// Utility functions for Detailer Dashboard

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a date string to a readable format
 */
export function formatDate(date: string | Date, format: 'short' | 'long' | 'time' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'time') {
    return d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date and time together
 */
export function formatDateTime(date: string, time: string): string {
  const dateObj = new Date(`${date}T${time}`);
  return formatDate(dateObj, 'long');
}

/**
 * Calculate total earnings from bookings
 */
export function calculateEarnings(bookings: Array<{ total_amount?: number; service_price?: number }>): number {
  return bookings.reduce((sum, booking) => {
    const amount = booking.total_amount || booking.service_price || 0;
    return sum + (typeof amount === 'string' ? parseFloat(amount) : amount);
  }, 0);
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance with unit
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km}km`;
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'accepted':
      return 'bg-[#1DA4F3]/20 border-[#1DA4F3]/40 text-[#1DA4F3]';
    case 'in_progress':
      return 'bg-[#6FF0C4]/20 border-[#6FF0C4]/40 text-[#6FF0C4]';
    case 'completed':
      return 'bg-[#32CE7A]/20 border-[#32CE7A]/40 text-[#32CE7A]';
    case 'cancelled':
    case 'no_show':
      return 'bg-red-500/20 border-red-500/40 text-red-400';
    case 'paid':
    case 'offered':
      return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    default:
      return 'bg-[#C6CFD9]/20 border-[#C6CFD9]/40 text-[#C6CFD9]';
  }
}

/**
 * Get payment status color class
 */
export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'paid':
      return 'text-[#32CE7A]';
    case 'processing':
      return 'text-yellow-400';
    case 'failed':
    case 'refunded':
      return 'text-red-400';
    default:
      return 'text-[#C6CFD9]';
  }
}

/**
 * Filter bookings by date range
 */
export function filterBookingsByDateRange(
  bookings: Array<{ scheduled_date?: string; scheduled_start?: string }>,
  range: 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'all'
): Array<any> {
  if (range === 'all') return bookings;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return bookings.filter((booking) => {
    const bookingDate = booking.scheduled_date 
      ? new Date(booking.scheduled_date)
      : booking.scheduled_start 
      ? new Date(booking.scheduled_start)
      : null;
    
    if (!bookingDate) return false;
    
    const bookingDateOnly = new Date(
      bookingDate.getFullYear(),
      bookingDate.getMonth(),
      bookingDate.getDate()
    );
    
    switch (range) {
      case 'today':
        return bookingDateOnly.getTime() === today.getTime();
      
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return bookingDateOnly.getTime() === tomorrow.getTime();
      
      case 'this_week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return bookingDate >= weekStart && bookingDate <= weekEnd;
      
      case 'this_month':
        return (
          bookingDate.getMonth() === today.getMonth() &&
          bookingDate.getFullYear() === today.getFullYear()
        );
      
      default:
        return true;
    }
  });
}

/**
 * Sort bookings
 */
export function sortBookings(
  bookings: Array<any>,
  sortBy: 'time' | 'distance' | 'price' | 'rating' | 'assignment'
): Array<any> {
  const sorted = [...bookings];
  
  switch (sortBy) {
    case 'time':
      return sorted.sort((a, b) => {
        const dateA = a.scheduled_date || a.scheduled_start || '';
        const dateB = b.scheduled_date || b.scheduled_start || '';
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    
    case 'price':
      return sorted.sort((a, b) => {
        const priceA = a.total_amount || a.service_price || 0;
        const priceB = b.total_amount || b.service_price || 0;
        return priceB - priceA;
      });
    
    case 'distance':
      // This would require current location
      return sorted;
    
    case 'rating':
      // This would require customer rating
      return sorted;
    
    case 'assignment':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
    
    default:
      return sorted;
  }
}

