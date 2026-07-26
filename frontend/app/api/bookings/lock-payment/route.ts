// File: app/api/bookings/lock-payment/route.ts
// ✅ SECURITY FIX: The amount is now derived entirely server-side from the
// booking's already-computed price (set at apply/approve time via
// lib/pricing.ts). The client can no longer dictate paymentAmount — any
// value it sends is ignored. Also validates the chain is actually enabled
// for the stay, and supports the reservation "remaining payment" leg
// (previously blocked because only status PENDING was accepted).

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { parseUnits } from 'viem';
import { chainConfig } from '@/lib/config';
import { requireBookingOwner, authErrorResponse } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, paymentToken, chainId } = body;

    if (!bookingId || !paymentToken || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, paymentToken, chainId' },
        { status: 400 }
      );
    }

    if (paymentToken !== 'USDC' && paymentToken !== 'USDT') {
      return NextResponse.json(
        { error: 'Invalid paymentToken. Must be USDC or USDT.' },
        { status: 400 }
      );
    }

    // 1. Ownership check — only the booking's owner (or an admin) may lock
    //    payment details for it.
    const { booking: ownedBooking } = await requireBookingOwner(bookingId);

    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: { stay: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 2. Status must be lockable: PENDING (full payment or reservation leg)
    //    or RESERVED (remaining-payment leg, after reservation is paid).
    const isRemainingLeg =
      booking.requiresReservation && booking.reservationPaid && !booking.remainingPaid;

    const isLockable =
      booking.status === BookingStatus.PENDING ||
      (booking.status === BookingStatus.RESERVED && isRemainingLeg);

    if (!isLockable) {
      return NextResponse.json(
        {
          error: `Cannot lock payment. Booking status is: ${booking.status}`,
          currentStatus: booking.status,
        },
        { status: 409 }
      );
    }

    // 3. Chain must be enabled for this stay (or, if the stay has no
    //    restriction configured, any globally supported chain).
    const stayEnabledChains = booking.stay.enabledChains;
    const chainAllowed =
      !stayEnabledChains || stayEnabledChains.length === 0 || stayEnabledChains.includes(chainId);

    if (!chainAllowed) {
      return NextResponse.json(
        { error: `Chain ${chainId} is not enabled for this stay` },
        { status: 400 }
      );
    }

    const chain = chainConfig[chainId];
    if (!chain) {
      return NextResponse.json({ error: `Unsupported chain ID: ${chainId}` }, { status: 400 });
    }

    const tokenInfo = chain.tokens[paymentToken];
    if (!tokenInfo) {
      return NextResponse.json(
        { error: `Token ${paymentToken} not supported on chain ${chain.name}` },
        { status: 400 }
      );
    }

    // 4. Derive the amount server-side — never trust a client-supplied number.
    let amount: number | null;

    if (isRemainingLeg) {
      amount = booking.remainingAmount;
    } else if (booking.requiresReservation && !booking.reservationPaid) {
      amount = booking.reservationAmount;
    } else if (!booking.requiresReservation) {
      amount =
        paymentToken === 'USDC'
          ? booking.selectedRoomPriceUSDC ?? booking.stay.priceUSDC
          : booking.selectedRoomPriceUSDT ?? booking.stay.priceUSDT;
    } else {
      // requiresReservation but both legs already paid — nothing left to lock.
      return NextResponse.json(
        { error: 'This booking has already been fully paid' },
        { status: 409 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Could not determine a valid payment amount for this booking' },
        { status: 500 }
      );
    }

    const amountBaseUnits = parseUnits(amount.toString(), tokenInfo.decimals).toString();

    // 5. Idempotent re-lock: if already locked to the same token, no-op.
    if (booking.paymentToken === paymentToken && booking.chainId === chainId && booking.paymentAmount === amount) {
      return NextResponse.json({ success: true, message: 'Payment details already locked' });
    }

    const updatedBooking = await db.booking.update({
      where: { id: booking.id },
      data: {
        paymentToken,
        paymentAmount: amount,
        amountBaseUnits,
        chainId,
        txHash: null,
        confirmedAt: null,
      },
      select: { bookingId: true, paymentToken: true, paymentAmount: true, chainId: true },
    });

    await db.activityLog.create({
      data: {
        bookingId: booking.id,
        userId: ownedBooking.userId,
        action: 'payment_details_locked',
        entity: 'booking',
        entityId: booking.id,
        details: {
          token: paymentToken,
          amount,
          amountBaseUnits,
          chainId,
          isRemainingLeg,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment details locked successfully',
      lockedDetails: updatedBooking,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API/LockPayment] Error locking payment details:', error);
    if ((error as any).code === 'P2025') {
      return NextResponse.json({ error: 'Booking record not found during update' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
