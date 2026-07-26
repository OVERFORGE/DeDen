// File: app/api/tickets/[ticketCode]/route.ts
// GET /api/tickets/[ticketCode] — full ticket details + rendered QR, for the
// owner or an admin.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireTicketOwner, authErrorResponse } from '@/lib/api-auth';
import { renderTicketQr } from '@/lib/ticket-service';

export async function GET(
  request: Request,
  context: { params: Promise<{ ticketCode: string }> }
) {
  try {
    const { ticketCode } = await context.params;
    const { ticket } = await requireTicketOwner(ticketCode);

    const full = await db.ticket.findUnique({
      where: { ticketCode },
      include: {
        stay: {
          select: { stayId: true, title: true, location: true, startDate: true, endDate: true, heroImage: true },
        },
        booking: {
          select: { bookingId: true, status: true, checkInDate: true, checkOutDate: true },
        },
      },
    });

    if (!full) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const qrDataUrl = await renderTicketQr(full.qrToken);

    return NextResponse.json({
      ticketCode: full.ticketCode,
      status: full.status,
      guestName: full.guestName,
      guestIndex: full.guestIndex,
      checkedInAt: full.checkedInAt,
      nftMinted: full.nftMinted,
      nftTokenId: full.nftTokenId,
      issuedAt: full.issuedAt,
      stay: full.stay,
      booking: full.booking,
      qrDataUrl,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
