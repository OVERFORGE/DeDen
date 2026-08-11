// app/api/admin/stays/[id]/metrics/route.ts

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

    // Find stay by id or stayId
    const stay = await db.stay.findFirst({
      where: {
        OR: [{ id: id }, { stayId: id }],
      },
    });

    if (!stay) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }

    const stayDbId = stay.id;

    // Fetch bookings for this stay
    const bookings = await db.booking.findMany({
      where: { stayId: stayDbId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            walletAddress: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch tickets for this stay
    let tickets: any[] = [];
    if ((db as any).ticket) {
      try {
        tickets = await (db as any).ticket.findMany({
          where: { stayId: stayDbId },
          include: {
            user: {
              select: {
                name: true,
                displayName: true,
                email: true,
              },
            },
            booking: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (err) {
        console.warn('[API] Warning querying tickets:', err);
      }
    }

    // Compute metrics
    const totalBookings = bookings.length;
    const activeBookings = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'RESERVED');
    const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'REFUNDED');
    const pendingBookings = bookings.filter((b) => b.status === 'PENDING' || b.status === 'WAITLISTED');

    const totalRevenueUSDC = activeBookings.reduce(
      (acc, b) => acc + (b.finalPrice || b.paymentAmount || b.totalPaid || 0),
      0
    );

    const totalGuestsRegistered = activeBookings.reduce((acc, b) => acc + (b.guestCount || 1), 0);
    const totalTicketsIssued = tickets.length;

    const checkedInTickets = tickets.filter((t) => t.status === 'CHECKED_IN');
    const totalCheckedIn = checkedInTickets.length;

    const attendanceRate = totalTicketsIssued > 0
      ? Math.round((totalCheckedIn / totalTicketsIssued) * 100)
      : totalGuestsRegistered > 0
      ? Math.round((totalCheckedIn / totalGuestsRegistered) * 100)
      : 0;

    // Build attendee roster
    // Combine ticket-level data & booking guest data
    const attendeesRoster = tickets.length > 0
      ? tickets.map((t) => ({
          ticketId: t.id,
          ticketCode: t.ticketCode,
          guestName: t.guestName || t.user?.displayName || t.user?.name || t.booking?.guestName || 'Guest',
          guestEmail: t.guestEmail || t.user?.email || t.booking?.guestEmail || '—',
          bookingId: t.booking?.bookingId || t.bookingId,
          roomName: t.booking?.selectedRoomName || 'Standard Bunk',
          bookingStatus: t.booking?.status || 'CONFIRMED',
          checkedIn: t.status === 'CHECKED_IN',
          checkedInAt: t.checkedInAt ? new Date(t.checkedInAt).toLocaleString() : null,
          checkedInBy: t.checkedInBy || null,
        }))
      : bookings.map((b) => ({
          ticketId: b.id,
          ticketCode: `BKG-${b.bookingId.slice(-6)}`,
          guestName: b.guestName || b.user?.displayName || b.user?.name || 'Guest',
          guestEmail: b.guestEmail || b.user?.email || '—',
          bookingId: b.bookingId,
          roomName: b.selectedRoomName || 'Standard Bunk',
          bookingStatus: b.status,
          checkedIn: false,
          checkedInAt: null,
          checkedInBy: null,
        }));

    return NextResponse.json({
      stay: {
        id: stay.id,
        stayId: stay.stayId,
        title: stay.title,
        location: stay.location,
        venue: stay.venue,
        startDate: stay.startDate,
        endDate: stay.endDate,
        status: stay.status,
        isPublished: stay.isPublished,
        slotsTotal: stay.slotsTotal,
        slotsAvailable: stay.slotsAvailable,
        priceUSDC: stay.priceUSDC,
        heroImage: stay.heroImage,
      },
      metrics: {
        totalBookings,
        activeBookingsCount: activeBookings.length,
        cancelledBookingsCount: cancelledBookings.length,
        pendingBookingsCount: pendingBookings.length,
        totalRevenueUSDC,
        totalGuestsRegistered,
        totalTicketsIssued,
        totalCheckedIn,
        attendanceRate,
        occupancyRate: stay.slotsTotal > 0
          ? Math.round(((stay.slotsTotal - stay.slotsAvailable) / stay.slotsTotal) * 100)
          : 0,
      },
      attendeesRoster,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching stay metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
