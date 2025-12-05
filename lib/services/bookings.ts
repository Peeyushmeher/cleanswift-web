'use server';

import { createClient } from '@/lib/supabase/server';
import type { Booking, BookingStatus } from '@/types/detailer';

type BookingSelect = Booking & {
  service?: Booking['service'];
  car?: Booking['car'];
  user?: Booking['user'];
  detailer?: Booking['detailer'];
  team?: Booking['team'];
};

const BOOKING_DETAIL_SELECT = `
  id,
  receipt_id,
  status,
  payment_status,
  scheduled_date,
  scheduled_time_start,
  scheduled_time_end,
  scheduled_start,
  scheduled_end,
  total_amount,
  service_price,
  addons_total,
  tax_amount,
  detailer_id,
  organization_id,
  team_id,
  address_line1,
  city,
  province,
  postal_code,
  latitude,
  longitude,
  location_notes,
  created_at,
  updated_at,
  completed_at,
  service:service_id (id, name, price, duration_minutes),
  car:car_id (id, make, model, year, license_plate),
  user:user_id (id, full_name, phone, email),
  detailer:detailer_id (id, full_name),
  team:team_id (id, name)
`;

export interface GetBookingsFilters {
  status?: BookingStatus | BookingStatus[];
  detailerId?: string;
  organizationId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  orderBy?: 'scheduled_date' | 'created_at';
  ascending?: boolean;
}

function asArray<T>(value?: T | T[]): T[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

function formatError(action: string, message?: string) {
  return new Error(message ? `Failed to ${action}: ${message}` : `Failed to ${action}`);
}

// Queries
export async function getBookings(filters: GetBookingsFilters = {}) {
  const supabase = await createClient();
  const {
    status,
    detailerId,
    organizationId,
    fromDate,
    toDate,
    limit = 200,
    orderBy = 'scheduled_date',
    ascending = true,
  } = filters;

  let query = supabase
    .from('bookings')
    .select(BOOKING_DETAIL_SELECT)
    .order(orderBy, { ascending })
    .order('scheduled_time_start', { ascending: true, nullsFirst: false })
    .limit(limit);

  const statusArray = asArray(status);
  if (statusArray?.length) {
    query = query.in('status', statusArray);
  }

  if (detailerId) {
    query = query.eq('detailer_id', detailerId);
  }

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  if (fromDate) {
    query = query.gte('scheduled_date', fromDate);
  }

  if (toDate) {
    query = query.lte('scheduled_date', toDate);
  }

  const { data, error } = await query.returns<BookingSelect[]>();

  if (error) {
    throw formatError('fetch bookings', error.message);
  }

  return (data ?? []) as Booking[];
}

export async function getBookingById(bookingId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_DETAIL_SELECT)
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    throw formatError('fetch booking', error?.message);
  }

  // Transform relations from arrays to single objects
  const transformed = {
    ...data,
    service: Array.isArray(data.service) ? data.service[0] : data.service,
    car: Array.isArray(data.car) ? data.car[0] : data.car,
    user: Array.isArray(data.user) ? data.user[0] : data.user,
    detailer: Array.isArray(data.detailer) ? data.detailer[0] : data.detailer,
    team: Array.isArray(data.team) ? data.team[0] : data.team,
  };

  return transformed as Booking;
}

// Commands
export async function updateBookingStatus(bookingId: string, newStatus: BookingStatus) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: newStatus,
  });

  if (error || !data) {
    throw formatError('update booking status', error?.message);
  }

  return data as Booking;
}

export async function assignBookingToDetailer(bookingId: string, detailerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('assign_detailer_to_booking', {
    p_booking_id: bookingId,
    p_detailer_id: detailerId,
  });

  if (error || !data) {
    throw formatError('assign booking to detailer', error?.message);
  }

  return data as Booking;
}

export async function acceptBooking(bookingId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('accept_booking', {
    p_booking_id: bookingId,
  });

  if (error || !data) {
    throw formatError('accept booking', error?.message);
  }

  return data as Booking;
}

export async function cancelBooking(bookingId: string) {
  return updateBookingStatus(bookingId, 'cancelled');
}

