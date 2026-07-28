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

    // Must match LOYALTY_DISCOUNT_PERCENT in lib/pricing.ts — that's what
    // actually gets applied at apply-time, flat, with no tiers. This
    // endpoint used to advertise tiered 20/25% numbers pricing.ts never
    // implemented, which would have shown guests a discount they wouldn't
    // actually get.
    const LOYALTY_DISCOUNT_PERCENT = 20;
    const isEligible = bookingCount >= 1;

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
      discountPercent: LOYALTY_DISCOUNT_PERCENT,
      previousBookingsCount: bookingCount,
      message: `Welcome back! You've earned a ${LOYALTY_DISCOUNT_PERCENT}% loyalty discount.`,
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