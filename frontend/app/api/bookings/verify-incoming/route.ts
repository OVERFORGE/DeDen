import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyManualPayment } from '@/lib/manual-verification';
import { BookingStatus } from '@prisma/client';
import { requireBookingOwner, authErrorResponse } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, senderAddress, chainId, paymentToken, isRemainingPayment } = body;

    if (!bookingId || !senderAddress || !chainId || !paymentToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Only the booking's owner (or an admin) may register a sender address
    // for manual verification.
    await requireBookingOwner(bookingId);

    const booking = await db.booking.findUnique({
      where: { bookingId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Update the booking with the sender address
    await db.booking.update({
      where: { bookingId },
      data: {
        senderAddress,
      },
    });

    // Fire off an asynchronous verification check (fire-and-forget)
    // In a production serverless environment, this might get killed early, 
    // but the status polling endpoint can also retry it.
    verifyManualPayment(bookingId, senderAddress, chainId, isRemainingPayment).catch((e: any) => {
        console.error("[Verify Incoming] Async verify error:", e);
    });

    return NextResponse.json({ success: true, message: 'Verification initiated' });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error initiating verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

