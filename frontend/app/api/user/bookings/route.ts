// File: app/api/user/bookings/route.ts
// Fixed version for MongoDB with proper ObjectId handling

import { db } from '@/lib/database';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';


export async function GET(request: Request) {
  
  
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    console.log('[API] ========================================');
    console.log('[API] Fetching bookings for wallet:', walletAddress);

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Find user by wallet address (case-insensitive)
    // MongoDB stores addresses with mixed case, so we search case-insensitively
    const user = await db.user.findFirst({
      where: { 
        walletAddress: {
          equals: walletAddress,
          mode: 'insensitive', // This makes it case-insensitive
        }
      },
    });

    if (!user) {
      console.log('[API] ❌ User not found');
      return NextResponse.json([]);
    }

    console.log('[API] ✅ User found!');
    console.log('[API] User ID:', user.id);
    console.log('[API] Display Name:', user.displayName);
    console.log('[API] Email:', user.email);

    // Try direct Prisma query first
    let bookings = await db.booking.findMany({
      where: {
        userId: user.id,
      },
      include: {
        stay: {
          select: {
            id: true,
            stayId: true,
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

    console.log('[API] Direct query found:', bookings.length, 'bookings');

    // If direct query returns nothing, try manual filtering as fallback
    if (bookings.length === 0) {
      console.log('[API] ⚠️ Direct query returned 0 bookings, trying manual filter...');
      
      const allBookings = await db.booking.findMany({
        include: {
          stay: {
            select: {
              id: true,
              stayId: true,
              title: true,
              location: true,
              startDate: true,
              endDate: true,
              priceUSDC: true,
              priceUSDT: true,
            },
          },
        },
      });

      console.log('[API] Total bookings in database:', allBookings.length);

      // Manual filter using string comparison
      const userIdString = user.id.toString();
      bookings = allBookings.filter(booking => {
        const bookingUserIdString = booking.userId.toString();
        const matches = bookingUserIdString === userIdString;
        
        if (allBookings.length <= 10) { // Only log if there aren't too many
          console.log('[API] Comparing:', {
            bookingId: booking.bookingId,
            bookingUserId: bookingUserIdString,
            lookingFor: userIdString,
            matches: matches
          });
        }
        
        return matches;
      });

      console.log('[API] Manual filter found:', bookings.length, 'bookings');
    }

    // Transform dates to ISO strings for JSON serialization
    const serializedBookings = bookings.map(booking => ({
      bookingId: booking.bookingId,
      status: booking.status,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestCount: booking.guestCount,
      selectedRoomId: booking.selectedRoomId,
      roomType: booking.roomType,
      paymentAmount: booking.paymentAmount,
      paymentToken: booking.paymentToken,
      txHash: booking.txHash,
      expiresAt: booking.expiresAt?.toISOString() || null,
      confirmedAt: booking.confirmedAt?.toISOString() || null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      stay: {
        id: booking.stay.id,
        stayId: booking.stay.stayId,
        title: booking.stay.title,
        location: booking.stay.location,
        startDate: booking.stay.startDate.toISOString(),
        endDate: booking.stay.endDate.toISOString(),
        priceUSDC: booking.stay.priceUSDC,
        priceUSDT: booking.stay.priceUSDT,
      },
    }));

    console.log('[API] ✅ Returning', serializedBookings.length, 'bookings');
    console.log('[API] ========================================');

    return NextResponse.json(serializedBookings);
  } catch (error) {
    console.error('[API] ❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 }
    );
  }
}