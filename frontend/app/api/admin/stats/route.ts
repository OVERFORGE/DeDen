// File: app/api/admin/stats/route.ts
// GET — admin only. Server-side aggregation for the admin dashboard
// counters, which were previously computed by filtering the *entire*
// booking list in the browser on every render — fine at a few hundred rows,
// not fine at scale.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { getChainName } from '@/lib/config';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const stayIdParam = searchParams.get('stayId') || undefined;

    // Accept the human-readable Stay.stayId (what the admin UI filters by)
    // and resolve it to the ObjectId that Booking.stayId actually holds.
    let baseWhere: any = {};
    if (stayIdParam && stayIdParam !== 'ALL') {
      const stay = await db.stay.findUnique({
        where: { stayId: stayIdParam },
        select: { id: true },
      });
      baseWhere.stayId = stay?.id ?? stayIdParam;
    }

    const [statusCounts, confirmedRows] = await Promise.all([
      db.booking.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      // Revenue is reduced in JS rather than via groupBy _sum because the
      // correct per-booking figure is `totalPaid ?? paymentAmount` — a
      // groupBy sum can't express that fallback and would silently drop
      // rows where only one of the two is populated. Scoped to CONFIRMED
      // and 4 tiny fields, so it stays cheap.
      db.booking.findMany({
        where: { ...baseWhere, status: BookingStatus.CONFIRMED },
        select: {
          chainId: true,
          paymentToken: true,
          totalPaid: true,
          paymentAmount: true,
        },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const status of Object.values(BookingStatus)) {
      counts[status.toLowerCase()] = 0;
    }
    for (const row of statusCounts) {
      counts[row.status.toLowerCase()] = row._count._all;
    }

    const revenue: Record<string, number> = {};
    const byChain: Record<string, { USDC: number; USDT: number }> = {};

    for (const row of confirmedRows) {
      const token = row.paymentToken || 'UNKNOWN';
      const amount = row.totalPaid ?? row.paymentAmount ?? 0;

      revenue[token] = (revenue[token] || 0) + amount;

      const chainLabel = row.chainId ? getChainName(row.chainId) : 'Unknown';
      if (!byChain[chainLabel]) {
        byChain[chainLabel] = { USDC: 0, USDT: 0 };
      }
      if (token === 'USDC' || token === 'USDT') {
        byChain[chainLabel][token] += amount;
      }
    }

    const totalBookings = statusCounts.reduce((sum, row) => sum + row._count._all, 0);

    return NextResponse.json({
      totalBookings,
      counts,
      revenue,
      byChain,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error computing admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
