// File: app/api/admin/bookings/[bookingId]/retry-nft/route.ts
// POST — admin only. Re-attempts NFT minting for a CONFIRMED booking whose
// mint previously failed. Tickets are never blocked by this (they're issued
// separately, before minting is attempted), so this is purely for
// completing the on-chain collectible after the fact.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { mintBookingNFT } from '@/lib/nft-service';

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    await requireAdmin();

    const { bookingId } = await context.params;

    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: { stay: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return NextResponse.json(
        { error: `Booking must be CONFIRMED to mint. Current status: ${booking.status}` },
        { status: 409 }
      );
    }

    if (booking.nftMinted) {
      return NextResponse.json({ error: 'NFT already minted for this booking' }, { status: 409 });
    }

    if (!booking.senderAddress || !booking.chainId) {
      return NextResponse.json(
        { error: 'Booking is missing senderAddress/chainId — cannot determine mint recipient' },
        { status: 400 }
      );
    }

    const nftResult = await mintBookingNFT({
      bookingId: booking.bookingId,
      recipientAddress: booking.senderAddress,
      chainId: booking.chainId,
      stayTitle: booking.stay.title,
      location: booking.stay.location,
      checkInDate: booking.checkInDate!,
      checkOutDate: booking.checkOutDate!,
      guestName: booking.guestName || 'Guest',
      numberOfNights: booking.numberOfNights || 0,
    });

    if (!nftResult.success) {
      return NextResponse.json({ error: nftResult.error || 'Minting failed' }, { status: 502 });
    }

    await db.booking.update({
      where: { bookingId },
      data: {
        nftTokenId: nftResult.tokenId?.toString(),
        nftContractAddress: nftResult.contractAddress,
        nftMinted: true,
        nftTxHash: nftResult.txHash,
        nftMintedAt: new Date(),
      },
    });

    await db.activityLog.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        action: 'nft_minted_retry',
        entity: 'booking',
        entityId: booking.id,
        details: {
          tokenId: nftResult.tokenId,
          contractAddress: nftResult.contractAddress,
          txHash: nftResult.txHash,
          chainId: booking.chainId,
        },
      },
    });

    return NextResponse.json({ success: true, tokenId: nftResult.tokenId, txHash: nftResult.txHash });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error retrying NFT mint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
