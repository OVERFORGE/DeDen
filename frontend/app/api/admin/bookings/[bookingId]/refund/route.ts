// File: app/api/admin/bookings/[bookingId]/refund/route.ts
// POST — admin only. Creates a Refund record, marks the booking REFUNDED,
// restores the slots it held, and emails the guest. The actual on-chain
// payout is manual (admin sends it themselves and can attach the tx hash
// here) — there is no automated treasury payout path.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus, PaymentToken } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { releaseStaySlots } from '@/lib/inventory';
import { releaseReferralUsage } from '@/lib/pricing';
import { sendRefundConfirmedEmail } from '@/lib/email';

const REFUNDABLE_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.RESERVED];

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { userId: adminId } = await requireAdmin();
    const { bookingId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { reason, adminNotes, refundTxHash } = body;

    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: { stay: true, user: true, refund: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!REFUNDABLE_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        { error: `Cannot refund a booking with status ${booking.status}` },
        { status: 409 }
      );
    }

    if (booking.refund) {
      return NextResponse.json({ error: 'This booking has already been refunded' }, { status: 409 });
    }

    // Determine what was actually paid: full amount for CONFIRMED, just the
    // reservation for RESERVED (remaining was never collected).
    const amount = booking.status === BookingStatus.RESERVED
      ? booking.reservationAmount
      : booking.totalPaid ?? booking.paymentAmount ?? booking.selectedRoomPriceUSDC;

    if (!amount) {
      return NextResponse.json(
        { error: 'Could not determine a refund amount for this booking' },
        { status: 500 }
      );
    }

    const tokenRaw = booking.status === BookingStatus.RESERVED
      ? booking.reservationToken
      : booking.paymentToken;
    const token = (tokenRaw === 'USDT' ? PaymentToken.USDT : PaymentToken.USDC);

    const refund = await db.refund.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        amount,
        token,
        status: refundTxHash ? 'completed' : 'requested',
        reason: reason || null,
        adminNotes: adminNotes || null,
        refundTxHash: refundTxHash || null,
        refundedAt: refundTxHash ? new Date() : null,
      },
    });

    await db.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.REFUNDED },
    });

    await releaseStaySlots(booking.stayId, booking.guestCount || 1);

    // Refunded bookings shouldn't keep consuming a referral code's maxUsage.
    if (booking.referralCodeId) {
      await releaseReferralUsage(booking.referralCodeId);
    }

    await db.activityLog.create({
      data: {
        userId: adminId,
        bookingId: booking.id,
        action: 'booking_refunded',
        entity: 'booking',
        entityId: booking.id,
        details: { amount, token, reason, adminNotes, refundTxHash, refundId: refund.id },
      },
    });

    let emailSent = false;
    if (booking.user?.email) {
      emailSent = await sendRefundConfirmedEmail({
        recipientEmail: booking.guestEmail || booking.user.email,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        amount,
        token,
        reason,
      });
    }

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount,
        token,
        status: refund.status,
      },
      emailSent,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error processing refund:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
