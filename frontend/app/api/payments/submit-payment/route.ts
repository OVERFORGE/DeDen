// File: app/api/payments/submit-payment/route.ts
// ✅ UPDATED: Handles both reservation and remaining payment submissions

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyPayment, checkTransactionUsed } from '@/lib/verification';
import { BookingStatus } from '@prisma/client';

/**
 * Updated API to submit payment for a booking with reservation support
 * POST /api/payments/submit-payment
 * Body: { bookingId: string, txHash: string, chainId: number, paymentToken: string, isRemainingPayment?: boolean }
 */
export async function POST(request: Request) {
  try {
    // 1. Read the request body
    const body = await request.json();
    const { bookingId, txHash, chainId, paymentToken, isRemainingPayment = false } = body;

    console.log('[API] Payment submission received:', { 
      bookingId, 
      txHash, 
      chainId, 
      paymentToken,
      isRemainingPayment 
    });

    // 2. Basic Validation
    if (!bookingId || !txHash || !chainId || !paymentToken) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, txHash, chainId, paymentToken' },
        { status: 400 }
      );
    }

    // 2.5. Validate txHash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash format' },
        { status: 400 }
      );
    }

    // 3. Check if this transaction hash has already been used
    const isUsed = await checkTransactionUsed(txHash);
    if (isUsed) {
      console.warn(`[API] Transaction replay attempt detected: ${txHash}`);
      return NextResponse.json(
        { 
          error: 'This transaction has already been used for another payment',
          code: 'TRANSACTION_ALREADY_USED'
        },
        { status: 409 }
      );
    }

    // 4. Find the booking in the database
    const booking = await db.booking.findUnique({
      where: { bookingId },
      select: {
        id: true,
        bookingId: true,
        status: true,
        paymentToken: true,
        paymentAmount: true,
        expiresAt: true,
        requiresReservation: true,
        reservationAmount: true,
        reservationPaid: true,
        remainingAmount: true,
        remainingPaid: true,
        reservationToken: true,
        remainingToken: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // ✅ NEW: Determine payment type and validate status
    if (booking.requiresReservation) {
      // This is a reservation-based booking
      
      if (isRemainingPayment) {
        // Processing REMAINING payment
        console.log('[API] Processing REMAINING payment for reservation booking');
        
        if (!booking.reservationPaid) {
          return NextResponse.json(
            { error: 'Cannot submit remaining payment - reservation not paid yet' },
            { status: 400 }
          );
        }
        
        if (booking.status !== BookingStatus.RESERVED) {
          return NextResponse.json(
            { 
              error: `Cannot submit remaining payment. Booking status is: ${booking.status}`,
              currentStatus: booking.status 
            },
            { status: 409 }
          );
        }
        
        if (booking.remainingPaid) {
          return NextResponse.json(
            { error: 'Remaining payment already processed' },
            { status: 409 }
          );
        }
        
        // Validate remaining payment token matches
        if (booking.remainingToken && booking.remainingToken !== paymentToken) {
          return NextResponse.json(
            { 
              error: `Payment token mismatch. Expected: ${booking.remainingToken}, Got: ${paymentToken}`,
              expectedToken: booking.remainingToken 
            },
            { status: 400 }
          );
        }
        
      } else {
        // Processing RESERVATION payment
        console.log('[API] Processing RESERVATION payment');
        
        if (booking.status !== BookingStatus.PENDING) {
          return NextResponse.json(
            { 
              error: `Cannot submit reservation payment. Booking status is: ${booking.status}`,
              currentStatus: booking.status 
            },
            { status: 409 }
          );
        }
        
        if (booking.reservationPaid) {
          return NextResponse.json(
            { error: 'Reservation already paid' },
            { status: 409 }
          );
        }
        
        // Validate reservation payment token matches if already set
        if (booking.reservationToken && booking.reservationToken !== paymentToken) {
          return NextResponse.json(
            { 
              error: `Payment token mismatch. Expected: ${booking.reservationToken}, Got: ${paymentToken}`,
              expectedToken: booking.reservationToken 
            },
            { status: 400 }
          );
        }
      }
      
    } else {
      // This is a full payment booking (no reservation)
      console.log('[API] Processing FULL payment (no reservation)');
      
      if (booking.status !== BookingStatus.PENDING) {
        return NextResponse.json(
          { 
            error: `Cannot submit payment. Booking status is: ${booking.status}`,
            currentStatus: booking.status 
          },
          { status: 409 }
        );
      }
      
      if (!booking.paymentToken || !booking.paymentAmount) {
        console.error('[API] Booking not configured for payment (lock-payment not called or failed).');
        return NextResponse.json(
          { error: 'Payment details were not locked. Please retry or contact support.' },
          { status: 400 }
        );
      }
    }

    // 5. Save the txHash to the booking immediately
    const updateData: any = {
      chainId: chainId,
    };
    
    if (isRemainingPayment) {
      updateData.remainingTxHash = txHash;
    } else if (booking.requiresReservation) {
      updateData.reservationTxHash = txHash;
    } else {
      updateData.txHash = txHash;
    }
    
    await db.booking.update({
      where: { bookingId },
      data: updateData,
    });

    // 6. Create activity log
    await db.activityLog.create({
      data: {
        bookingId: booking.id,
        action: isRemainingPayment ? 'remaining_payment_submitted' : 'payment_submitted',
        entity: 'booking',
        entityId: booking.id,
        details: {
          txHash,
          chainId,
          token: paymentToken,
          isReservation: booking.requiresReservation && !isRemainingPayment,
          isRemainingPayment,
          amount: isRemainingPayment 
            ? booking.remainingAmount 
            : (booking.requiresReservation ? booking.reservationAmount : booking.paymentAmount),
        },
      },
    });

    console.log('[API] Payment submission saved. Starting background verification...');

    // 7. Call verifyPayment with correct flag
    verifyPayment(
      bookingId, 
      txHash, 
      chainId, 
      isRemainingPayment, // ✅ Pass the flag
      10, 
      3000
    ).catch((error) => {
      console.error('[API] Background verification error:', error);
    });

    // 8. Respond Immediately
    const responseMessage = isRemainingPayment
      ? 'Remaining payment submitted for verification'
      : booking.requiresReservation
        ? 'Reservation payment submitted for verification'
        : 'Transaction submitted for verification';

    return NextResponse.json({
      success: true,
      bookingId: booking.bookingId,
      status: 'verifying',
      message: responseMessage,
      paymentType: isRemainingPayment ? 'remaining' : (booking.requiresReservation ? 'reservation' : 'full'),
    });

  } catch (error) {
    console.error('[API] Error submitting payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}