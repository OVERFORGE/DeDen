// File: app/api/bookings/status/[bookingId]/route.ts
// ✅ Requires ownership — this is the endpoint the payment page polls while
// verifying, so it was leaking live payment status to anyone who guessed a
// bookingId.
// ✅ Also settles stale PENDING bookings on read, and keeps the manual
// verification trigger: if the booking is PENDING with a senderAddress set
// (user clicked "I have paid" without a captured tx hash), each poll kicks
// off a background scan for a matching on-chain transfer.

import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { requireBookingOwner, authErrorResponse } from '@/lib/api-auth';
import { settleBookingIfStale } from '@/lib/booking-lifecycle';

/**
 * Get the current status of a booking
 * GET /api/bookings/status/[bookingId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID not provided' },
        { status: 400 }
      );
    }

    await requireBookingOwner(bookingId);
    await settleBookingIfStale(bookingId);

    const booking = await db.booking.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        status: true,
        txHash: true,
        chainId: true,
        confirmedAt: true,
        expiresAt: true,
        paymentToken: true,
        paymentAmount: true,
        senderAddress: true,
        requiresReservation: true,
        reservationPaid: true,
        remainingPaid: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // If the booking is PENDING but has a senderAddress, the user clicked
    // "I have paid" without a captured tx hash. Trigger a scan here so the
    // frontend's polling doubles as a verification retry loop.
    if (booking.status === 'PENDING' && booking.senderAddress) {
      const isRemainingPayment = booking.requiresReservation && booking.reservationPaid && !booking.remainingPaid;

      // Fire asynchronously so we don't block the status response. In a
      // strict serverless environment this might get killed early, but
      // since the client polls repeatedly, it gets retried constantly.
      import('@/lib/manual-verification').then(({ verifyManualPayment }) => {
        verifyManualPayment(
          booking.bookingId,
          booking.senderAddress as string,
          booking.chainId || 1,
          isRemainingPayment
        ).catch((e) => console.error('Manual verify error:', e));
      });
    }

    return NextResponse.json({
      bookingId: booking.bookingId,
      status: booking.status,
      txHash: booking.txHash,
      chainId: booking.chainId,
      confirmedAt: booking.confirmedAt,
      expiresAt: booking.expiresAt,
      paymentToken: booking.paymentToken,
      paymentAmount: booking.paymentAmount,
    });

  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching booking status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
