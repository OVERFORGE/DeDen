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
import { recomputeStayAvailability } from '@/lib/inventory';
import { issueTicketsForBooking } from '@/lib/ticket-service';

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

    // Occupancy is derived from live bookings (lib/inventory.ts), not
    // tracked incrementally — any status change that could affect who's
    // occupying a night just triggers a resync of the display counter.
    await recomputeStayAvailability(booking.stayId);

    // Forcing a booking to CONFIRMED (e.g. an off-chain payment) skips the
    // normal verifyPayment() path entirely, which is the only other place
    // tickets get issued — without this, the guest is "confirmed" with
    // nothing to scan at the door.
    if (status === BookingStatus.CONFIRMED) {
      try {
        await issueTicketsForBooking(booking.bookingId);
      } catch (ticketError) {
        console.error('[Override Status] Ticket issuance failed:', ticketError);
      }
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
