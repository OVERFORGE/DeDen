import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyPayment } from '@/lib/verification';
import { requireBookingOwner, authErrorResponse } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, txHash, chainId, isRemainingPayment } = body;

    if (!bookingId || !txHash || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Only the booking's owner (or an admin) may trigger verification for it.
    await requireBookingOwner(bookingId);

    const booking = await db.booking.findUnique({
      where: { bookingId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Fire off asynchronous verification (fire-and-forget)
    verifyPayment(bookingId, txHash, chainId, isRemainingPayment, 10, 3000).catch((e: any) => {
        console.error("[Verify Popup Tx] Async verify error:", e);
    });

    return NextResponse.json({ success: true, message: 'Verification initiated' });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error initiating popup verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
