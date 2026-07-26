// File: app/api/admin/bookings/[bookingId]/override-status/route.ts
// POST — admin only. Manually forces a booking to a new status (e.g. an
// off-chain payment was confirmed by other means, or a booking needs to be
// force-cancelled). Requires a written reason so overrides are always
// auditable — this bypasses every normal state-machine guard, so it should
// leave a clear trail.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { holdStaySlots, releaseStaySlots } from '@/lib/inventory';

const SLOT_HOLDING_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.RESERVED];

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { userId: adminId } = await requireAdmin();
    const { bookingId } = await context.params;
    const body = await request.json();
    const { status, adminNotes } = body;

    if (!status || !Object.values(BookingStatus).includes(status)) {
      return NextResponse.json({ error: 'A valid status is required' }, { status: 400 });
    }
    if (!adminNotes || typeof adminNotes !== 'string' || !adminNotes.trim()) {
      return NextResponse.json({ error: 'adminNotes is required to override a booking status' }, { status: 400 });
    }

    const booking = await db.booking.findUnique({ where: { bookingId } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const previousStatus = booking.status;

    if (previousStatus === status) {
      return NextResponse.json({ error: `Booking is already ${status}` }, { status: 409 });
    }

    await db.booking.update({
      where: { bookingId },
      data: {
        status,
        adminNotes: adminNotes.trim(),
        ...(status === BookingStatus.CONFIRMED ? { confirmedAt: new Date() } : {}),
      },
    });

    // Reconcile slot inventory: hold on entering a slot-holding status,
    // release on leaving one.
    const wasHolding = SLOT_HOLDING_STATUSES.includes(previousStatus);
    const nowHolding = SLOT_HOLDING_STATUSES.includes(status);
    const guestCount = booking.guestCount || 1;

    if (!wasHolding && nowHolding) {
      await holdStaySlots(booking.stayId, guestCount);
    } else if (wasHolding && !nowHolding) {
      await releaseStaySlots(booking.stayId, guestCount);
    }

    await db.activityLog.create({
      data: {
        userId: adminId,
        bookingId: booking.id,
        action: 'status_overridden',
        entity: 'booking',
        entityId: booking.id,
        details: { previousStatus, newStatus: status, adminNotes: adminNotes.trim(), overriddenBy: adminId },
      },
    });

    return NextResponse.json({ success: true, previousStatus, newStatus: status });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error overriding booking status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
