import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus, PaymentToken } from '@prisma/client';
import { sendApprovalEmail } from '@/lib/email'; // <-- This import is correct

/**
 * Approve a waitlisted booking and move it to PENDING with payment details
 * POST /api/admin/bookings/[bookingId]/approve
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;

    // Optional: Get payment details from request body
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

    // 1.b. Check for user and email
    if (!booking.user || !booking.user.email) {
      return NextResponse.json(
        { error: 'Booking has no user or user has no email' },
        { status: 400 }
      );
    }

    // 2. Check if booking is waitlisted
    if (booking.status !== BookingStatus.WAITLISTED) {
      return NextResponse.json(
        { 
          error: `Cannot approve. Booking status is: ${booking.status}`,
          currentStatus: booking.status 
        },
        { status: 409 }
      );
    }

    // 3. Determine payment amount
    // Use provided amount or default to stay's price
    const finalAmount = paymentAmount || booking.stay.priceUSDC;

    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount. Stay price not configured.' },
          { status: 400 }
      );
    }

    // 4. Calculate amount in base units (for blockchain)
    const decimals = 6; // USDC/USDT have 6 decimals
    const amountBaseUnits = (finalAmount * Math.pow(10, decimals)).toString();

    // 5. Set expiry time
    const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

    // 6. Update booking to PENDING with payment details
    const updatedBooking = await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.PENDING,
        paymentToken: paymentToken as PaymentToken,
        paymentAmount: finalAmount,
        amountBaseUnits: amountBaseUnits,
        expiresAt: expiresAt,
        // Set default chain (BSC Testnet)
        chain: 'bsc',
        chainId: 97,
      },
    });

    // 7. Log activity
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

    // --- 8. UPDATED EMAIL NOTIFICATION ---
    const paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingId}`;
    
    try {
      await sendApprovalEmail({
        recipientEmail: booking.user.email!,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location, // These are safe, schema says they are required
        startDate: booking.stay.startDate,   // These are safe, schema says they are required
        endDate: booking.stay.endDate,       // These are safe, schema says they are required
        
        // --- THE FIX ---
        paymentAmount: finalAmount,         // Pass the calculated amount
        paymentToken: paymentToken as string, // Pass the chosen token
        
        paymentUrl,
        expiresAt,
      });

      console.log(`[API] Approval email sent to ${booking.user.email} for booking ${bookingId}`);
    } catch (emailError) {
      console.error('[API] Failed to send approval email:', emailError);
      // Don't fail the entire request if email fails, just log it
    }
    // --- END OF UPDATE ---

    return NextResponse.json({
      success: true,
      message: 'Booking approved and moved to pending payment',
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

/**
 * Batch approve multiple bookings
 * PATCH /api/admin/bookings/approve-batch 
 * (Note: Changed method to PATCH as it's updating multiple)
 */
export async function PATCH(request: Request) {
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

        // --- 3. UPDATED EMAIL NOTIFICATION (BATCH) ---
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

            // --- THE FIX ---
            paymentAmount: finalAmount,
            paymentToken: paymentToken as string,
            
            paymentUrl,
            expiresAt,

          });
          console.log(`[API-BATCH] Approval email sent to ${booking.user.email}`);
        } catch (emailError) {
          console.error(`[API-BATCH] Failed to send email for ${bookingId}:`, emailError);
          // Don't fail the whole batch, just note it
          results.failed.push({
            bookingId,
            error: `Booking approved but email failed: ${(emailError as Error).message}`,
          });
          continue; // Move to next booking
        }
        // --- END OF UPDATE ---

        results.approved.push(bookingId);
      } catch (error) {
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