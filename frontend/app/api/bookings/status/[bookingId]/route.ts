// File: app/api/bookings/status/[bookingId]/route.ts

// 1. IMPORT 'NextRequest' HERE
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/database';

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

    // ✅ NEW: If the booking is PENDING but has a senderAddress, 
    // it means the user clicked "I have paid". We should trigger a scan here
    // so that the frontend's 10-second polling acts as our verification cron loop!
    if (booking.status === 'PENDING' && booking.senderAddress) {
        const isRemainingPayment = booking.requiresReservation && booking.reservationPaid && !booking.remainingPaid;
        
        // Fire asynchronously so we don't block the status response
        // Note: In strict Serverless environments this might get killed,
        // but since we poll every 10s, it gets retried constantly.
        import('@/lib/manual-verification').then(({ verifyManualPayment }) => {
            verifyManualPayment(
                booking.bookingId, 
                booking.senderAddress as string, 
                booking.chainId || 1, // Fallback chain
                isRemainingPayment
            ).catch(e => console.error("Manual verify error:", e));
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
    console.error('[API] Error fetching booking status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}