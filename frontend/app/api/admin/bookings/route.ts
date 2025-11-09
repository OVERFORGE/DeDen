import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';

/**
 * GET /api/admin/bookings
 * Fetches bookings for the admin panel.
 * Can filter by status, e.g., /api/admin/bookings?status=WAITLISTED
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let whereClause = {};

    if (status) {
      // Ensure the status is a valid enum
      if (Object.values(BookingStatus).includes(status as BookingStatus)) {
        whereClause = {
          status: status as BookingStatus,
        };
      } else {
        return NextResponse.json(
          { error: `Invalid status value: ${status}` },
          { status: 400 }
        );
      }
    }

    const bookings = await db.booking.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
            walletAddress: true,
            role: true,
          },
        },
        stay: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Show newest first
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('[API] Error fetching admin bookings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}