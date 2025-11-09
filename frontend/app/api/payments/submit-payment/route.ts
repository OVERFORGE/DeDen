// File: app/api/payments/submit-payment/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyPayment } from '@/lib/verification';
import { BookingStatus } from '@prisma/client';

/**
 * Updated API to submit payment for a booking
 * POST /api/payments/submit-payment
 * 
 * Body: { bookingId: string, txHash: string, chainId: number }
 * 
 * This is called from the frontend AFTER the user has sent their transaction
 */
export async function POST(request: Request) {
  try {
    // 1. Read the request body
    const body = await request.json();
    const { bookingId, txHash, chainId } = body;

    // 2. Basic Validation
    if (!bookingId || !txHash || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, txHash, chainId' },
        { status: 400 }
      );
    }

    // 3. Find the booking in the database
    const booking = await db.booking.findUnique({
      where: { bookingId },
      select: {
        id: true,
        bookingId: true,
        status: true,
        paymentToken: true,
        paymentAmount: true,
        expiresAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // 4. Check if booking is in PENDING status
    if (booking.status !== BookingStatus.PENDING) {
      return NextResponse.json(
        { 
          error: `Cannot submit payment. Booking status is: ${booking.status}`,
          currentStatus: booking.status 
        },
        { status: 409 } // 409 Conflict
      );
    }

    // 5. Check if payment session has expired
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      // Auto-update to EXPIRED
      await db.booking.update({
        where: { bookingId },
        data: { status: BookingStatus.EXPIRED },
      });

      return NextResponse.json(
        { error: 'Payment session has expired' },
        { status: 410 } // 410 Gone
      );
    }

    // 6. Check if payment details are set
    if (!booking.paymentToken || !booking.paymentAmount) {
      return NextResponse.json(
        { error: 'Booking does not have payment details configured' },
        { status: 400 }
      );
    }

    // 7. Save the txHash to the booking immediately
    // This is good for logging, even before verification is complete
    await db.booking.update({
      where: { bookingId },
      data: {
        txHash: txHash,
        chainId: chainId,
      },
    });

    // 8. Create activity log
    await db.activityLog.create({
      data: {
        bookingId: booking.id,
        action: 'payment_submitted',
        entity: 'booking',
        entityId: booking.id,
        details: {
          txHash,
          chainId,
          token: booking.paymentToken,
          amount: booking.paymentAmount,
        },
      },
    });

    // 9. --- "Fire-and-Forget" ---
    // Call verifyPayment but do NOT 'await' it.
    // This tells the function to run in the background.
    verifyPayment(bookingId, txHash, chainId);

    // 10. --- Respond Immediately ---
    // We send this response back to the frontend right away,
    // while the verification runs in the background.
    return NextResponse.json({
      success: true,
      bookingId: booking.bookingId,
      status: 'verifying',
      message: 'Transaction submitted for verification',
    });

  } catch (error) {
    console.error('[API] Error submitting payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}