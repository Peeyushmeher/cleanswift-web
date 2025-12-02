'use server';

import { NextRequest, NextResponse } from 'next/server';

import { mapApiError, requireApiAdmin } from '@/lib/api/middleware';
import { getBookingById } from '@/lib/services/bookings';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireApiAdmin();
    const booking = await getBookingById(params.id);
    return NextResponse.json({ data: booking });
  } catch (error) {
    const { status, body } = mapApiError(error);
    return NextResponse.json(body, { status });
  }
}

