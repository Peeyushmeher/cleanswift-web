import { NextRequest, NextResponse } from 'next/server';

import { mapApiError, requireApiAdmin } from '@/lib/api/middleware';
import { getBookings } from '@/lib/services/bookings';
import type { BookingStatus } from '@/types/detailer';

const parseStatus = (value: string | null): BookingStatus | BookingStatus[] | undefined => {
  if (!value) {
    return undefined;
  }

  if (value.includes(',')) {
    return value.split(',').map((status) => status.trim()) as BookingStatus[];
  }

  return value as BookingStatus;
};

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin();

    const params = request.nextUrl.searchParams;
    const status = parseStatus(params.get('status'));
    const detailerId = params.get('detailerId') ?? undefined;
    const organizationId = params.get('organizationId') ?? undefined;
    const fromDate = params.get('fromDate') ?? undefined;
    const toDate = params.get('toDate') ?? undefined;
    const limit = params.get('limit') ? Number(params.get('limit')) : undefined;
    const orderBy = params.get('orderBy') === 'created_at' ? 'created_at' : 'scheduled_date';
    const ascending = params.get('ascending') !== 'false';

    const bookings = await getBookings({
      status,
      detailerId,
      organizationId,
      fromDate,
      toDate,
      limit,
      orderBy,
      ascending,
    });

    return NextResponse.json({ data: bookings });
  } catch (error) {
    const { status, body } = mapApiError(error);
    return NextResponse.json(body, { status });
  }
}

