import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapApiError } from '@/lib/api/middleware';

/**
 * Check if detailers are available for a booking at a given location and time
 * This can be called before booking creation to show "no detailer available" messages
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      booking_date,
      booking_time_start,
      booking_time_end,
      service_duration_minutes,
      booking_lat,
      booking_lng,
      exclude_org_detailers = false,
    } = body;

    // Validate required fields
    if (!booking_date || !booking_time_start) {
      return NextResponse.json(
        { error: 'booking_date and booking_time_start are required' },
        { status: 400 }
      );
    }

    if (!booking_lat || !booking_lng) {
      return NextResponse.json(
        { error: 'booking_lat and booking_lng are required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Call the database function to check availability
    // Note: Parameter order matches the function signature (required params first, then optional)
    const { data, error } = await supabase.rpc('check_detailer_availability_in_radius', {
      p_booking_date: booking_date,
      p_booking_time_start: booking_time_start,
      p_booking_lat: booking_lat,
      p_booking_lng: booking_lng,
      p_booking_time_end: booking_time_end || null,
      p_service_duration_minutes: service_duration_minutes || null,
      p_exclude_org_detailers: exclude_org_detailers,
    });

    if (error) {
      console.error('Error checking detailer availability:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to check availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = mapApiError(error);
    return NextResponse.json(body, { status });
  }
}

