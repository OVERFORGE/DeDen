// File: app/api/tickets/route.ts
// GET /api/tickets — the current user's tickets, across all bookings.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireUser, authErrorResponse } from '@/lib/api-auth';

export async function GET() {
  try {
    const { userId } = await requireUser();

    const tickets = await db.ticket.findMany({
      where: { userId },
      include: {
        stay: {
          select: {
            stayId: true,
            title: true,
            location: true,
            startDate: true,
            endDate: true,
            heroImage: true,
          },
        },
        booking: {
          select: {
            bookingId: true,
            status: true,
            checkInDate: true,
            checkOutDate: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return NextResponse.json(
      tickets.map((t) => ({
        ticketCode: t.ticketCode,
        status: t.status,
        guestName: t.guestName,
        guestIndex: t.guestIndex,
        checkedInAt: t.checkedInAt,
        nftMinted: t.nftMinted,
        nftTokenId: t.nftTokenId,
        issuedAt: t.issuedAt,
        stay: t.stay,
        booking: t.booking,
      }))
    );
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
