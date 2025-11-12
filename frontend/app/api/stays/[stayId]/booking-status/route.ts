// File: app/api/stays/[stayId]/booking-status/route.ts
// API endpoint to check if user has a booking for a specific stay

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/stays/[stayId]/booking-status?wallet=0x...
 * Check if a user has a booking for this stay
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ stayId: string }> }
) {
  try {
    const { stayId } = await context.params;
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Find the stay
    const stay = await db.stay.findUnique({
      where: { stayId: stayId },
      select: { id: true },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    // Find user by wallet address (case-insensitive)
    const user = await db.user.findFirst({
      where: {
        walletAddress: {
          equals: walletAddress,
          mode: 'insensitive',
        },
      },
    });

    // If no user exists, they definitely have no booking
    if (!user) {
      return NextResponse.json({
        hasBooking: false,
      });
    }

    // Check for existing booking
    const booking = await db.booking.findFirst({
      where: {
        userId: user.id,
        stayId: stay.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // No booking found
    if (!booking) {
      return NextResponse.json({
        hasBooking: false,
      });
    }

    // Booking exists - return status info
    return NextResponse.json({
      hasBooking: true,
      status: booking.status,
      bookingId: booking.bookingId,
      confirmedAt: booking.confirmedAt?.toISOString() || null,
      canPay: booking.status === 'PENDING' && booking.expiresAt && new Date(booking.expiresAt) > new Date(),
      expiresAt: booking.expiresAt?.toISOString() || null,
    });

  } catch (error) {
    console.error('[API] Error checking booking status:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}