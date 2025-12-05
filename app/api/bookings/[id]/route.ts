import { NextRequest, NextResponse } from 'next/server';

import { mapApiError, requireApiAdmin } from '@/lib/api/middleware';
import { getBookingById } from '@/lib/services/bookings';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiAdmin();
    const { id } = await params;
    const booking = await getBookingById(id);
    return NextResponse.json({ data: booking });
  } catch (error) {
    const { status, body } = mapApiError(error);
    return NextResponse.json(body, { status });
  }
}

