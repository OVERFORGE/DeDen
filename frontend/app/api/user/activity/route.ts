// File: app/api/user/activity/route.ts
//
// Own activity feed. ActivityLog already records every meaningful event
// (payment confirmed, ticket checked in, guest-list opt-in, etc.) but there
// was no user-facing view of it — only the admin one.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireUser, authErrorResponse } from '@/lib/api-auth';

const LIMIT = 15;

export async function GET() {
  try {
    const { userId } = await requireUser();

    const logs = await db.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        action: true,
        entity: true,
        details: true,
        createdAt: true,
        bookingId: true,
      },
    });

    // Attach the human-readable stay title where we can, so the feed doesn't
    // just show raw booking ObjectIds.
    const bookingIds = [...new Set(logs.map((l) => l.bookingId).filter(Boolean))] as string[];
    const bookings = bookingIds.length
      ? await db.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, bookingId: true, stay: { select: { title: true } } },
        })
      : [];
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    return NextResponse.json(
      logs.map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        stayTitle: log.bookingId ? bookingMap.get(log.bookingId)?.stay.title || null : null,
        bookingId: log.bookingId ? bookingMap.get(log.bookingId)?.bookingId || null : null,
      }))
    );
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching user activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
