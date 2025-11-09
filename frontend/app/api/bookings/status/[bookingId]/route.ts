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
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
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