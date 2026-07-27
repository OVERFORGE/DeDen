// File: app/api/admin/bookings/route.ts
// ✅ Handles orphaned user references by fetching users separately
// ✅ Server-side filtering + pagination. This previously returned EVERY
//    booking unbounded and let the browser filter the whole set on each
//    render — fine at a few hundred rows, not beyond that. Status/stay/
//    search filters now run in the query so pagination is correct (paging
//    over filtered results, not filtering one page).

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

/**
 * GET /api/admin/bookings
 * Query: ?page=1&pageSize=25&status=WAITLISTED&stayId=ETH-MUM-2026&search=foo
 * Returns { bookings, total, page, pageSize, totalPages }
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stayIdParam = searchParams.get('stayId');
    const search = searchParams.get('search')?.trim();

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );

    const whereClause: any = {};

    // --- Status filter ---
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

    // --- Stay filter ---
    // The admin UI filters by the human-readable Stay.stayId (e.g.
    // "ETH-MUM-2026"), but Booking.stayId holds the Mongo ObjectId — so
    // resolve the former to the latter before querying.
    if (stayIdParam && stayIdParam !== 'ALL') {
      const stay = await db.stay.findUnique({
        where: { stayId: stayIdParam },
        select: { id: true },
      });
      // If it isn't a known human stayId, fall back to treating it as an ObjectId.
      whereClause.stayId = stay?.id ?? stayIdParam;
    }

    // --- Search filter ---
    // Wallet/display name/email live on User, so resolve matching users
    // first and OR their ids in alongside the booking-level fields.
    if (search) {
      const matchingUsers = await db.user.findMany({
        where: {
          OR: [
            { walletAddress: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      whereClause.OR = [
        { bookingId: { contains: search, mode: 'insensitive' } },
        { guestName: { contains: search, mode: 'insensitive' } },
        { guestEmail: { contains: search, mode: 'insensitive' } },
        ...(matchingUserIds.length > 0 ? [{ userId: { in: matchingUserIds } }] : []),
      ];
    }

    const total = await db.booking.count({ where: whereClause });

    // Fetch bookings WITHOUT including user (to avoid orphaned-user errors)
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Fetch users separately (won't fail if some users are missing)
    const userIds = [...new Set(bookings.map((b) => b.userId))];
    const users = await db.user.findMany({
      where: {
        id: { in: userIds },
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

    const userMap = new Map(users.map((u) => [u.id, u]));

    const transformedBookings = bookings.map((booking) => {
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
        },
      };
    });

    return NextResponse.json({
      bookings: transformedBookings,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
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
