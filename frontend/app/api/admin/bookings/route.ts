// File: app/api/admin/bookings/route.ts
// ✅ FIXED: Handles orphaned user references by fetching separately

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';

/**
 * GET /api/admin/bookings
 * Fetches all bookings with complete data for admin panel
 * Handles orphaned user references gracefully
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stayId = searchParams.get('stayId');

    // Build where clause
    let whereClause: any = {};

    if (status && status !== 'ALL') {
      if (Object.values(BookingStatus).includes(status as BookingStatus)) {
        whereClause.status = status as BookingStatus;
      } else {
        return NextResponse.json(
          { error: `Invalid status value: ${status}` },
          { status: 400 }
        );
      }
    }

    if (stayId) {
      whereClause.stayId = stayId;
    }

    // ✅ FIX: Fetch bookings WITHOUT including user (to avoid orphan errors)
    const bookings = await db.booking.findMany({
      where: whereClause,
      include: {
        stay: {
          select: {
            id: true,
            stayId: true,
            title: true,
            location: true,
            startDate: true,
            endDate: true,
            rooms: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ✅ Fetch all unique user IDs
    const userIds = [...new Set(bookings.map(b => b.userId))];
    
    // ✅ Fetch users separately (this won't fail if some users are missing)
    const users = await db.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        walletAddress: true,
        role: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        socialTwitter: true,
        socialTelegram: true,
        socialLinkedin: true,
        gender: true,
        age: true,
      },
    });

    // ✅ Create a map for quick user lookup
    const userMap = new Map(users.map(u => [u.id, u]));

    // ✅ Transform bookings to include user data or fallback
    const transformedBookings = bookings.map(booking => {
      const user = userMap.get(booking.userId);
      
      return {
        ...booking,
        user: user || {
          id: booking.userId,
          displayName: booking.guestName || 'Unknown User',
          email: booking.guestEmail || 'No email',
          walletAddress: null,
          role: null,
          firstName: null,
          lastName: null,
          mobileNumber: booking.guestMobile || null,
          socialTwitter: null,
          socialTelegram: null,
          socialLinkedin: null,
          gender: booking.guestGender || null,
          age: booking.guestAge || null,
        }
      };
    });

    return NextResponse.json(transformedBookings);
  } catch (error) {
    console.error('[API] Error fetching admin bookings:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}