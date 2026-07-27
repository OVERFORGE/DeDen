// File: app/api/admin/bookings/[bookingId]/backfill-tickets/route.ts
// POST — admin only. Issues any missing tickets for a CONFIRMED booking.
//
// Why this exists: the Ticket model was added after this codebase already
// had CONFIRMED bookings in production. issueTicketsForBooking() only ever
// runs automatically as part of the payment-verification flow — a booking
// confirmed before that code existed has no tickets and never will unless
// something calls it retroactively. issueTicketsForBooking is additive and
// idempotent (skips guest indices that already have a ticket), so this is
// safe to call on any CONFIRMED booking, repeatedly.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { issueTicketsForBooking } from '@/lib/ticket-service';

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { userId: adminId } = await requireAdmin();
    const { bookingId } = await context.params;

    const booking = await db.booking.findUnique({ where: { bookingId } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return NextResponse.json(
        { error: `Booking must be CONFIRMED to issue tickets. Current status: ${booking.status}` },
        { status: 409 }
      );
    }

    const before = await db.ticket.count({ where: { bookingId: booking.id } });
    const tickets = await issueTicketsForBooking(bookingId);
    const issuedNow = tickets.length - before;

    if (issuedNow > 0) {
      await db.activityLog.create({
        data: {
          bookingId: booking.id,
          userId: adminId,
          action: 'tickets_backfilled',
          entity: 'booking',
          entityId: booking.id,
          details: { issuedNow, totalTickets: tickets.length },
        },
      });
    }

    return NextResponse.json({
      success: true,
      totalTickets: tickets.length,
      issuedNow,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error backfilling tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
