import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus, PaymentToken } from '@prisma/client';
import { sendApprovalEmail } from '@/lib/email';

/**
 * Batch approve multiple bookings
 * PATCH /api/admin/bookings/approve-batch
 */
export async function PATCH(request: NextRequest) { // Use NextRequest
  try {
    const body = await request.json();
    const { bookingIds, paymentToken = 'USDC', sessionExpiryMinutes = 15 } = body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json(
        { error: 'bookingIds array is required' },
        { status: 400 }
      );
    }

    const results = {
      approved: [] as string[],
      failed: [] as { bookingId: string; error: string }[],
    };

    // Process each booking
    for (const bookingId of bookingIds) {
      try {
        const booking = await db.booking.findUnique({
          where: { bookingId },
          include: { 
            stay: true,
            user: { select: { email: true, displayName: true } }
          },
        });

        if (!booking || booking.status !== BookingStatus.WAITLISTED) {
          results.failed.push({
            bookingId,
            error: 'Not found or not waitlisted',
          });
          continue;
        }

        if (!booking.user || !booking.user.email) {
          results.failed.push({
            bookingId,
            error: 'User has no email',
          });
          continue;
        }

        const finalAmount = booking.stay.priceUSDC; // Defaulting to priceUSDC for batch
        const decimals = 6;
        const amountBaseUnits = (finalAmount * Math.pow(10, decimals)).toString();
        const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

        await db.booking.update({
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

        // Send Email
        const paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingId}`;
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
          
          console.log(`[API-BATCH] Approval email sent to ${booking.user.email}`);
          results.approved.push(bookingId); // Only approved if DB + Email succeed

        } catch (emailError: any) {
          console.error(`[API-BATCH] Failed to send email for ${bookingId}:`, emailError);
          // Booking was approved, but email failed. Report it as failed.
          results.failed.push({
            bookingId,
            error: `Booking approved but email failed: ${emailError.message}`,
          });
        }
      } catch (error) {
        // This catches errors from findUnique or booking.update
        results.failed.push({
          bookingId,
          error: (error as Error).message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: bookingIds.length,
        approved: results.approved.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    console.error('[API] Error batch approving bookings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}