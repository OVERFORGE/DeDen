// File: app/api/admin/bookings/[bookingId]/resend-email/route.ts
// POST — admin only. Re-sends the lifecycle email matching the booking's
// current status (approval link, reservation confirmation, or full
// confirmation) — for when a guest says "I never got the email."

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { sendApprovalEmail, sendReservationConfirmedEmail, sendConfirmationEmail } from '@/lib/email';
import { getTicketEmailPayload } from '@/lib/ticket-service';

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { userId: adminId } = await requireAdmin();
    const { bookingId } = await context.params;

    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: { stay: true, user: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (!booking.user?.email) {
      return NextResponse.json({ error: 'Booking has no user email' }, { status: 400 });
    }

    let emailType: string;

    if (booking.status === BookingStatus.PENDING) {
      const amount = booking.requiresReservation ? booking.reservationAmount! : (booking.selectedRoomPriceUSDC || booking.stay.priceUSDC);
      await sendApprovalEmail({
        recipientEmail: booking.guestEmail || booking.user.email,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        startDate: booking.stay.startDate,
        endDate: booking.stay.endDate,
        paymentAmount: amount,
        paymentToken: 'USDC/USDT',
        paymentUrl: `/booking/${bookingId}`,
        expiresAt: booking.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        isReservation: booking.requiresReservation,
        numberOfNights: booking.numberOfNights || 0,
        fullAmount: booking.selectedRoomPriceUSDC || booking.stay.priceUSDC,
      });
      emailType = 'approval';
    } else if (booking.status === BookingStatus.RESERVED) {
      await sendReservationConfirmedEmail({
        recipientEmail: booking.guestEmail || booking.user.email,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        startDate: booking.stay.startDate,
        endDate: booking.stay.endDate,
        reservationAmount: booking.reservationAmount || 0,
        reservationToken: (booking.reservationToken as 'USDC' | 'USDT') || 'USDC',
        remainingAmount: booking.remainingAmount || 0,
        txHash: booking.reservationTxHash || '',
        chainId: booking.reservationChainId || booking.chainId || 0,
        numberOfNights: booking.numberOfNights || 0,
      });
      emailType = 'reservation_confirmed';
    } else if (booking.status === BookingStatus.CONFIRMED) {
      await sendConfirmationEmail({
        recipientEmail: booking.guestEmail || booking.user.email,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        startDate: booking.stay.startDate,
        endDate: booking.stay.endDate,
        paidAmount: booking.totalPaid || booking.paymentAmount || 0,
        paidToken: (booking.paymentToken as 'USDC' | 'USDT') || 'USDC',
        txHash: booking.txHash || booking.remainingTxHash || '',
        chainId: booking.chainId || 0,
        tickets: await getTicketEmailPayload(booking.bookingId),
      });
      emailType = 'confirmation';
    } else {
      return NextResponse.json(
        { error: `No lifecycle email applies to status ${booking.status}` },
        { status: 400 }
      );
    }

    await db.activityLog.create({
      data: {
        userId: adminId,
        bookingId: booking.id,
        action: 'email_resent',
        entity: 'booking',
        entityId: booking.id,
        details: { emailType, resentBy: adminId },
      },
    });

    return NextResponse.json({ success: true, emailType });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error resending email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
