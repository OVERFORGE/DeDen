// File: app/api/admin/stays/[id]/guests/route.ts
// GET — admin only. Full guest roster for a stay, including secondary
// guests (previously invisible to admin — only the primary contact was
// ever stored/shown) and each guest's ticket check-in state.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const stay = await db.stay.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!stay) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }

    const bookings = await db.booking.findMany({
      where: { stayId: id },
      select: {
        id: true,
        bookingId: true,
        status: true,
        guestCount: true,
        guests: true,
        guestName: true,
        guestEmail: true,
        checkInDate: true,
        checkOutDate: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const bookingIds = bookings.map((b) => b.id);
    const tickets = await db.ticket.findMany({
      where: { bookingId: { in: bookingIds } },
      select: { bookingId: true, guestIndex: true, ticketCode: true, status: true, checkedInAt: true },
    });

    const ticketByBookingAndIndex = new Map(
      tickets.map((t) => [`${t.bookingId}:${t.guestIndex}`, t])
    );

    const roster = bookings.flatMap((booking) => {
      const guests = (booking.guests as any[]) || [];
      const guestList = guests.length > 0
        ? guests
        : [{ fullName: booking.guestName, email: booking.guestEmail }];

      return guestList.map((guest, index) => {
        const ticket = ticketByBookingAndIndex.get(`${booking.id}:${index}`);
        return {
          bookingId: booking.bookingId,
          bookingStatus: booking.status,
          guestIndex: index,
          isPrimary: index === 0,
          fullName: guest?.fullName || null,
          email: index === 0 ? guest?.email || booking.guestEmail : guest?.email || null,
          phone: guest?.phone || null,
          age: guest?.age || null,
          gender: guest?.gender || null,
          country: guest?.country || null,
          profession: guest?.profession || null,
          xHandle: guest?.xHandle || null,
          telegram: guest?.telegram || null,
          ticketCode: ticket?.ticketCode || null,
          ticketStatus: ticket?.status || null,
          checkedInAt: ticket?.checkedInAt || null,
        };
      });
    });

    return NextResponse.json({
      stay: { id: stay.id, title: stay.title },
      totalBookings: bookings.length,
      totalGuests: roster.length,
      checkedIn: roster.filter((g) => g.ticketStatus === 'CHECKED_IN').length,
      guests: roster,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching guest roster:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
