// File: app/api/tickets/verify/route.ts
// POST /api/tickets/verify — admin/staff only. Body: { qrToken }.
// Verifies the HMAC signature and returns the ticket's current state
// WITHOUT mutating anything — use /api/tickets/[ticketCode]/check-in to
// actually check someone in.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { verifyQrToken } from '@/lib/ticket-service';
import { isRateLimited, getRequestIp } from '@/lib/rate-limit';

// 60 scans per admin/IP per minute — a scanner rapid-firing bad reads
// shouldn't be able to hammer the DB, but this shouldn't ever bind a real
// door-staff workflow (a few scans/second at most).
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  try {
    const { userId } = await requireAdmin();

    if (isRateLimited(`ticket-verify:${userId || getRequestIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ valid: false, error: 'Too many requests, slow down' }, { status: 429 });
    }

    const body = await request.json();
    const { qrToken } = body;

    if (!qrToken || typeof qrToken !== 'string') {
      return NextResponse.json({ valid: false, error: 'qrToken is required' }, { status: 400 });
    }

    const verified = verifyQrToken(qrToken);
    if (!verified.valid) {
      return NextResponse.json({ valid: false, error: verified.reason || 'Invalid token' }, { status: 200 });
    }

    const ticket = await db.ticket.findUnique({
      where: { ticketCode: verified.ticketCode },
      include: {
        stay: { select: { title: true, location: true, startDate: true, endDate: true } },
        booking: { select: { bookingId: true, guestCount: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ valid: false, error: 'Ticket not found' }, { status: 200 });
    }

    // Defense in depth: confirm the token stored on this ticket still
    // matches the one presented (guards against a valid-signature token
    // for a ticket that was since re-issued/voided and given a new token).
    if (ticket.qrToken !== qrToken) {
      return NextResponse.json({ valid: false, error: 'Token no longer valid for this ticket' }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      ticket: {
        ticketCode: ticket.ticketCode,
        status: ticket.status,
        guestName: ticket.guestName,
        checkedInAt: ticket.checkedInAt,
        stay: ticket.stay,
        bookingId: ticket.booking.bookingId,
      },
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error verifying ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
