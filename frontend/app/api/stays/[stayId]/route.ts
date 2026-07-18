import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/stays/[stayId]
 * Fetches public details for a single stay,
 * including dates, duration, prices, room options, AND reservation settings.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ stayId: string }> } 
) {
  try {
    const { stayId } = await context.params; 

    if (!stayId) {
      return NextResponse.json(
        { error: 'Stay ID not provided' },
        { status: 400 }
      );
    }

    const stay = await db.stay.findUnique({
      where: { stayId: stayId },
      select: {
        // ✅ Basic Info
        stayId: true,
        title: true,
        location: true,
        description: true,
        
        // ✅ Date & Duration
        startDate: true,
        endDate: true,
        duration: true,
        
        // ✅ Pricing
        priceUSDC: true,
        priceUSDT: true,
        
        // ✅ Room options
        rooms: true,
        
        // ✅ Additional useful fields
        slotsTotal: true,
        slotsAvailable: true,
        allowWaitlist: true,
        images: true,
        amenities: true,
        highlights: true,

        // ✅ NEW: Reservation System Fields (CRITICAL FIX)
        // These must be selected so the frontend knows if reservation is enabled
        requiresReservation: true,
        reservationAmount: true,
        minNightsForReservation: true,
      },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    // ✅ Convert dates to ISO strings for JSON serialization
    const stayWithFormattedDates = {
      ...stay,
      startDate: stay.startDate.toISOString(),
      endDate: stay.endDate.toISOString(),
    };

    return NextResponse.json(stayWithFormattedDates);

  } catch (error) {
    console.error('[API] Error fetching stay details:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}