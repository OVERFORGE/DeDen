// File: app/api/user/check-loyalty/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path to your auth config
import {prisma} from '@/lib/prisma'; // Adjust path to your Prisma client

/**
 * GET /api/user/check-loyalty
 * Check if the authenticated user is eligible for loyalty discount
 * 
 * Loyalty criteria:
 * - User must have at least 1 CONFIRMED booking
 * - Returns discount percentage and booking count
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { 
          isEligible: false,
          error: 'Not authenticated' 
        },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { 
          isEligible: false,
          error: 'User ID not found' 
        },
        { status: 400 }
      );
    }

    // Count confirmed bookings for this user
    const confirmedBookings = await prisma.booking.findMany({
      where: {
        userId,
        status: 'CONFIRMED',
      },
      select: {
        id: true,
        stayId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const bookingCount = confirmedBookings.length;

    // Determine eligibility and discount percentage
    // You can implement tiered discounts here
    let isEligible = false;
    let discountPercent = 0;

    if (bookingCount >= 1) {
      isEligible = true;
      
      // Tiered loyalty discounts (optional - customize as needed)
      if (bookingCount >= 5) {
        discountPercent = 25; // 25% for 5+ bookings
      } else if (bookingCount >= 3) {
        discountPercent = 20; // 20% for 3-4 bookings
      } else {
        discountPercent = 20; // 20% for 1-2 bookings (default)
      }
    }

    if (!isEligible) {
      return NextResponse.json({
        isEligible: false,
        discountPercent: 0,
        previousBookingsCount: 0,
        message: 'Complete your first booking to unlock loyalty rewards!',
      });
    }

    return NextResponse.json({
      isEligible: true,
      discountPercent,
      previousBookingsCount: bookingCount,
      message: `Welcome back! You've earned a ${discountPercent}% loyalty discount.`,
      tier: bookingCount >= 5 ? 'platinum' : bookingCount >= 3 ? 'gold' : 'silver',
    });
  } catch (error) {
    console.error('[Check Loyalty] Error:', error);
    return NextResponse.json(
      { 
        isEligible: false,
        error: 'Failed to check loyalty status' 
      },
      { status: 500 }
    );
  }
}