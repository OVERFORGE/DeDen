// File: app/api/admin/stats/route.ts
// GET — admin only. Server-side aggregation for the admin dashboard
// counters, which were previously computed by filtering the *entire*
// booking list in the browser on every render — fine at a few hundred rows,
// not fine at scale.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const stayId = searchParams.get('stayId') || undefined;

    const baseWhere = stayId ? { stayId } : {};

    const [statusCounts, confirmedByToken] = await Promise.all([
      db.booking.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      db.booking.groupBy({
        by: ['paymentToken'],
        where: { ...baseWhere, status: BookingStatus.CONFIRMED },
        _sum: { totalPaid: true, paymentAmount: true },
        _count: { _all: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const status of Object.values(BookingStatus)) {
      counts[status.toLowerCase()] = 0;
    }
    for (const row of statusCounts) {
      counts[row.status.toLowerCase()] = row._count._all;
    }

    const revenue = confirmedByToken.reduce(
      (acc, row) => {
        const token = row.paymentToken || 'UNKNOWN';
        const amount = row._sum.totalPaid ?? row._sum.paymentAmount ?? 0;
        acc[token] = (acc[token] || 0) + amount;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalBookings = statusCounts.reduce((sum, row) => sum + row._count._all, 0);

    return NextResponse.json({
      totalBookings,
      counts,
      revenue,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error computing admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
