// File: app/api/user/bookings/route.ts
// ✅ SECURITY FIX: Previously resolved bookings by a `?wallet=` query param
// with no auth at all — anyone could dump another user's bookings (name,
// email, phone, tx hashes) by guessing/reusing a wallet address. Now
// resolves from the authenticated session only. This also fixes the
// Google-only-user case: those users have no wallet, so the old endpoint
// always returned an empty list for them — now it returns their bookings
// regardless of whether a wallet is linked.
//
// The `?wallet=` param is accepted but ignored, so the existing frontend
// call (`/api/user/bookings?wallet=...`) keeps working with zero changes.

import { db } from '@/lib/database';
import { NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { userId } = await requireUser();

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json([]);
    }

    const bookings = await db.booking.findMany({
      where: { userId: user.id },
      include: {
        stay: {
          select: {
            id: true,
            stayId: true,
            title: true,
            location: true,
            startDate: true,
            endDate: true,
            duration: true,
            priceUSDC: true,
            priceUSDT: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const serializedBookings = bookings.map(booking => ({
      bookingId: booking.bookingId,
      status: booking.status,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestCount: booking.guestCount,
      selectedRoomId: booking.selectedRoomId,
      roomType: booking.roomType,

      numberOfNights: booking.numberOfNights,
      checkInDate: booking.checkInDate?.toISOString() || null,
      checkOutDate: booking.checkOutDate?.toISOString() || null,

      pricePerNightUSDC: booking.pricePerNightUSDC,
      pricePerNightUSDT: booking.pricePerNightUSDT,
      selectedRoomPriceUSDC: booking.selectedRoomPriceUSDC,
      selectedRoomPriceUSDT: booking.selectedRoomPriceUSDT,
      selectedRoomName: booking.selectedRoomName,

      requiresReservation: booking.requiresReservation,
      reservationAmount: booking.reservationAmount,
      reservationPaid: booking.reservationPaid,
      remainingAmount: booking.remainingAmount,
      remainingPaid: booking.remainingPaid,

      paymentAmount: booking.paymentAmount,
      paymentToken: booking.paymentToken,
      txHash: booking.txHash,
      chain: booking.chain,
      chainId: booking.chainId,
      blockNumber: booking.blockNumber,

      nftMinted: booking.nftMinted || false,
      nftTokenId: booking.nftTokenId,
      nftContractAddress: booking.nftContractAddress,
      nftTxHash: booking.nftTxHash,

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
        duration: booking.stay.duration,
        priceUSDC: booking.stay.priceUSDC,
        priceUSDT: booking.stay.priceUSDT,
      },
    }));

    return NextResponse.json(serializedBookings);
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching user bookings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
