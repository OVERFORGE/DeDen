// File: app/api/user/bookings/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/user/bookings?wallet=0x...
 * Fetches all bookings for a specific wallet address
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Find user by wallet address
    const user = await db.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      // Return empty array if user doesn't exist yet
      return NextResponse.json([]);
    }

    // Fetch all bookings for this user
    const bookings = await db.booking.findMany({
      where: {
        userId: user.id,
      },
      include: {
        stay: {
          select: {
            title: true,
            location: true,
            startDate: true,
            endDate: true,
            priceUSDC: true,
            priceUSDT: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('[API] Error fetching user bookings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}