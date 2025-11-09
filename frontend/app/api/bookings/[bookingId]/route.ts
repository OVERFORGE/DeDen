import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/bookings/[bookingId]
 * Fetches the details for a single booking, e.g., for the payment page.
 * This should be secured to only let the owner view it.
 */
export async function GET(
  request: Request,
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

    // TODO: Add authentication here to ensure the user owns this booking

    const booking = await db.booking.findUnique({
      where: { bookingId },
      select: {
        bookingId: true,
        status: true,
        txHash: true,
        expiresAt: true,
        // ✅ ADD THESE FIELDS - They contain the payment details
        paymentToken: true,
        paymentAmount: true,
        amountBaseUnits: true,
        chain: true,
        chainId: true,
        stay: {
          select: {
            title: true,
            priceUSDC: true,
            priceUSDT: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('[API] Error fetching booking details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}