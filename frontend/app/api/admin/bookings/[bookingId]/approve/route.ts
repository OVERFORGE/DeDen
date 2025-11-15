import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/database";
import { BookingStatus } from "@prisma/client";
import { sendApprovalEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";

/**
 * Approve a waitlisted booking and move it to PENDING
 * POST /api/admin/bookings/[bookingId]/approve
 * 
 * FIXED: Does NOT lock payment token - user chooses during payment
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;

    const body = await request.json();
    const { sessionExpiryMinutes = 15 } = body;

    // 1. Find the booking with room prices
    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: {
        stay: true,
        user: true,
      },
    }) as Prisma.BookingGetPayload<{
      include: {
        stay: true;
        user: true;
      };
    }>;

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // 2. Check for user and email
    if (!booking.user || !booking.user.email) {
      return NextResponse.json(
        {
          error: "Booking has no user or user has no email. Cannot send notification.",
        },
        { status: 400 }
      );
    }

    // 3. Check if booking is waitlisted
    if (booking.status !== BookingStatus.WAITLISTED) {
      return NextResponse.json(
        {
          error: `Cannot approve. Booking status is: ${booking.status}`,
          currentStatus: booking.status,
        },
        { status: 409 }
      );
    }

    // 4. Set expiry time
    const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

    // 5. Update booking to PENDING without locking payment details
    // User will choose token during payment
    const updatedBooking = await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.PENDING,
        expiresAt: expiresAt,
        // DO NOT SET: paymentToken, paymentAmount, chainId
        // These will be set during lock-payment call
      },
    });

    // 6. Log activity
    await db.activityLog.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        action: "waitlist_approved",
        entity: "booking",
        entityId: booking.id,
        details: {
          previousStatus: BookingStatus.WAITLISTED,
          newStatus: BookingStatus.PENDING,
          expiresAt: expiresAt,
          // Room prices are already saved in the booking
          selectedRoomPriceUSDC: booking.selectedRoomPriceUSDC,
          selectedRoomPriceUSDT: booking.selectedRoomPriceUSDT,
        },
      },
    });

    // 7. Send Email
const paymentUrl = `/booking/${bookingId}`;    let emailSent = false;
    let emailError = null;

    try {
      // Determine display amount for email (USDC by default for display)
      const displayAmount = booking.selectedRoomPriceUSDC || booking.stay.priceUSDC;
      
      await sendApprovalEmail({
        recipientEmail: booking.user.email!,
        recipientName: booking.user.displayName || "Guest",
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        startDate: booking.stay.startDate,
        endDate: booking.stay.endDate,
        paymentAmount: displayAmount,
        paymentToken: "USDC/USDT", // Show both options
        paymentUrl,
        expiresAt,
      });

      emailSent = true;
      console.log(
        `[API] Approval email sent to ${booking.user.email} for booking ${bookingId}`
      );
    } catch (error: any) {
      console.error("[API] Failed to send approval email:", error);
      emailError = error.message || "Unknown email error";
    }

    // 8. Return Response
    return NextResponse.json({
      success: true,
      message: "Booking approved and moved to pending payment",
      emailSent: emailSent,
      emailError: emailError,
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
        expiresAt: updatedBooking.expiresAt,
        paymentLink: `/booking/${bookingId}`,
        // Return both room prices so frontend knows what's available
        roomPriceUSDC: booking.selectedRoomPriceUSDC,
        roomPriceUSDT: booking.selectedRoomPriceUSDT,
      },
    });
  } catch (error) {
    console.error("[API] Error approving booking:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}