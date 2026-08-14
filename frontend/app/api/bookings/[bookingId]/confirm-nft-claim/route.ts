// File: app/api/bookings/[bookingId]/confirm-nft-claim/route.ts
//
// POST — the guest calls this after their own claimNFT() transaction (sent
// from their own wallet, paying their own gas) confirms on-chain. This is
// the only thing that ever flips `Booking.nftMinted` to true: the client's
// say-so is never trusted, the on-chain receipt and its BookingNFTMinted
// event are re-derived server-side and cross-checked against the booking
// (right bookingId, right recipient) before anything is persisted.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireBookingOwner, authErrorResponse } from '@/lib/api-auth';
import { verifyClaimTx } from '@/lib/nft-service';
import { NFTS_ENABLED } from '@/lib/features';

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    if (!NFTS_ENABLED) {
      return NextResponse.json({ error: 'NFT features are disabled' }, { status: 404 });
    }

    const { bookingId } = await context.params;
    const { booking, userId } = await requireBookingOwner(bookingId);

    const body = await request.json().catch(() => ({}));
    const txHash = body?.txHash;

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
    }

    if (booking.nftMinted) {
      return NextResponse.json({ success: true, message: 'NFT already recorded as minted', tokenId: booking.nftTokenId });
    }

    if (!booking.nftClaimable || !booking.chainId || !booking.senderAddress) {
      return NextResponse.json(
        { error: 'This booking has no pending NFT claim to confirm' },
        { status: 409 }
      );
    }

    const result = await verifyClaimTx(booking.chainId, txHash, booking.bookingId, booking.senderAddress);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Could not verify the claim transaction' }, { status: 400 });
    }

    await db.booking.update({
      where: { id: booking.id },
      data: {
        nftMinted: true,
        nftTokenId: result.tokenId?.toString(),
        nftTxHash: txHash,
        nftMintedAt: new Date(),
      },
    });

    await db.activityLog.create({
      data: {
        userId,
        bookingId: booking.id,
        action: 'nft_claimed',
        entity: 'booking',
        entityId: booking.id,
        details: { tokenId: result.tokenId, txHash, chainId: booking.chainId },
      },
    });

    return NextResponse.json({ success: true, tokenId: result.tokenId });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error confirming NFT claim:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
