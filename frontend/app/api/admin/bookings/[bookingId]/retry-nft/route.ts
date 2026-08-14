// File: app/api/admin/bookings/[bookingId]/retry-nft/route.ts
// POST — admin only. Re-issues a self-claim NFT voucher for a CONFIRMED
// booking that doesn't have one (e.g. it was never issued before this
// feature existed, or the original signing attempt failed). Tickets are
// never blocked by this (they're issued separately), so this is purely for
// making the on-chain collectible claimable after the fact. This no longer
// mints directly — the guest still claims (and pays gas for) their own NFT
// from the dashboard, same as the normal payment-confirmed path.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { issueClaimVoucher } from '@/lib/nft-service';
import { NFTS_ENABLED } from '@/lib/features';

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    await requireAdmin();

    if (!NFTS_ENABLED) {
      return NextResponse.json({ error: 'NFT features are disabled' }, { status: 404 });
    }

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

    const voucher = await issueClaimVoucher({
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

    if (!voucher.success) {
      return NextResponse.json({ error: voucher.error || 'Voucher signing failed' }, { status: 502 });
    }

    await db.booking.update({
      where: { bookingId },
      data: {
        nftClaimable: true,
        nftVoucherSignature: voucher.signature,
        nftVoucherExpiry: voucher.expiry ? new Date(voucher.expiry * 1000) : null,
        nftMetadataURI: voucher.metadataURI,
        nftContractAddress: voucher.contractAddress,
      },
    });

    await db.activityLog.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        action: 'nft_voucher_issued_retry',
        entity: 'booking',
        entityId: booking.id,
        details: {
          contractAddress: voucher.contractAddress,
          chainId: booking.chainId,
        },
      },
    });

    return NextResponse.json({ success: true, message: 'NFT is now claimable — the guest can mint it from their dashboard.' });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error retrying NFT mint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
