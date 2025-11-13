import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus, PaymentToken } from '@prisma/client';
import { sendApprovalEmail } from '@/lib/email';

/**
 * Approve a waitlisted booking and move it to PENDING with payment details
 * POST /api/admin/bookings/[bookingId]/approve
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> } // Changed to Promise
) {
  try {
    const { bookingId } = await context.params; // Added await

    const body = await request.json();
    const { 
      paymentToken = 'USDC', 
      paymentAmount,
      sessionExpiryMinutes = 15 
    } = body;

    // 1. Find the booking
    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: {
        stay: true,
        user: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // 2. Check for user and email
    if (!booking.user || !booking.user.email) {
      return NextResponse.json(
        { error: 'Booking has no user or user has no email. Cannot send notification.' },
        { status: 400 }
      );
    }

    // 3. Check if booking is waitlisted
    if (booking.status !== BookingStatus.WAITLISTED) {
      return NextResponse.json(
        { 
          error: `Cannot approve. Booking status is: ${booking.status}`,
          currentStatus: booking.status 
        },
        { status: 409 }
      );
    }

    // 4. Determine payment amount
const finalAmount = paymentAmount || booking.selectedRoomPrice || booking.stay.priceUSDC;
    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount. Stay price not configured.' },
        { status: 400 }
      );
    }

    // 5. Calculate amount in base units
    const decimals = 6;
    const amountBaseUnits = (finalAmount * Math.pow(10, decimals)).toString();

    // 6. Set expiry time
    const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

    // 7. Update booking
    const updatedBooking = await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.PENDING,
        paymentToken: paymentToken as PaymentToken,
        paymentAmount: finalAmount,
        amountBaseUnits: amountBaseUnits,
        expiresAt: expiresAt,
        chain: 'bsc',
        chainId: 97,
      },
    });

    // 8. Log activity
    await db.activityLog.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        action: 'waitlist_approved',
        entity: 'booking',
        entityId: booking.id,
        details: {
          previousStatus: BookingStatus.WAITLISTED,
          newStatus: BookingStatus.PENDING,
          paymentAmount: finalAmount,
          paymentToken: paymentToken,
          expiresAt: expiresAt,
        },
      },
    });

    // 9. Send Email
    const paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingId}`;
    let emailSent = false;
    let emailError = null;

    try {
      await sendApprovalEmail({
        recipientEmail: booking.user.email!,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        startDate: booking.stay.startDate,
        endDate: booking.stay.endDate,
        paymentAmount: finalAmount,
        paymentToken: paymentToken as string,
        paymentUrl,
        expiresAt,
      });
      
      emailSent = true;
      console.log(`[API] Approval email sent to ${booking.user.email} for booking ${bookingId}`);

    } catch (error: any) {
      console.error('[API] Failed to send approval email:', error);
      emailError = error.message || 'Unknown email error';
    }

    // 10. Return Response
    return NextResponse.json({
      success: true,
      message: 'Booking approved and moved to pending payment',
      emailSent: emailSent,
      emailError: emailError,
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
        paymentAmount: updatedBooking.paymentAmount,
        paymentToken: updatedBooking.paymentToken,
        expiresAt: updatedBooking.expiresAt,
        paymentLink: `/booking/${bookingId}`,
      },
    });

  } catch (error) {
    console.error('[API] Error approving booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}