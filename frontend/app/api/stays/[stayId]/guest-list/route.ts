import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireUser, authErrorResponse } from '@/lib/api-auth';

/**
 * GET /api/stays/[stayId]/guest-list
 *
 * Fetches the opt-in guest list for a specific stay (name, role, socials —
 * never email/phone). Only includes CONFIRMED guests who set
 * optInGuestList: true. Requires authentication, per the TODO this route
 * previously shipped with unaddressed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ stayId: string }> }
) {
  try {
    await requireUser();

    const { stayId } = await params;

    if (!stayId) {
      return NextResponse.json(
        { error: 'Stay ID not provided' },
        { status: 400 }
      );
    }

    // Find the stay to ensure it exists
    const stay = await db.stay.findUnique({
      where: { stayId },
      select: { id: true },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    // Fetch all bookings for this stay that are CONFIRMED and OPTED-IN
    const bookings = await db.booking.findMany({
      where: {
        stayId: stay.id,
        status: BookingStatus.CONFIRMED,
        optInGuestList: true, // Only fetch guests who opted-in
      },
      // Include the public user details
      include: {
        user: {
          select: {
            displayName: true,
            role: true,
            socialTwitter: true,
            socialLinkedin: true,
            // DO NOT include email, name, etc.
          },
        },
      },
      orderBy: {
        confirmedAt: 'asc',
      },
    });

    // Format the data for the frontend
    const guestList = bookings.map((booking) => ({
      displayName: booking.user.displayName,
      role: booking.user.role || 'Builder',
      socialTwitter: booking.user.socialTwitter,
      socialLinkedin: booking.user.socialLinkedin,
      confirmedAt: booking.confirmedAt,
    }));

    return NextResponse.json(guestList);
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching guest list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}