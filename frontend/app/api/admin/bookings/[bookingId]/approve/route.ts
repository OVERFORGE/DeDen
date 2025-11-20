// File: app/api/admin/bookings/[bookingId]/approve/route.ts
// ✅ UPDATED: Forces reservation logic check (Nights > 2) during approval to fix old bookings

import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/database";
import { BookingStatus } from "@prisma/client";
import { sendApprovalEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";

/**
 * Approve a waitlisted booking and move it to PENDING
 * POST /api/admin/bookings/[bookingId]/approve
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;
    const body = await request.json();
    const { sessionExpiryMinutes = 15 } = body;

    // 1. Find the booking
    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: {
        stay: true,
        user: true,
      },
    }) as Prisma.BookingGetPayload<{
      include: { stay: true; user: true };
    }>;

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // 2. Check for user and email
    if (!booking.user || !booking.user.email) {
      return NextResponse.json(
        { error: "Booking has no user or user has no email." },
        { status: 400 }
      );
    }

    // 3. Check status
    if (booking.status !== BookingStatus.WAITLISTED) {
      return NextResponse.json(
        {
          error: `Cannot approve. Booking status is: ${booking.status}`,
          currentStatus: booking.status,
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------------------
    // ✅ FIX: Force Re-calculation of Payment Logic
    // This ensures the > 2 nights rule is applied even if the
    // initial application data was wrong or old.
    // -------------------------------------------------------------
    
    const numberOfNights = booking.numberOfNights || 0;
    
    // ⚠️ THE FIX IS HERE: We removed 'booking.stay.requiresReservation' check.
    // Now, ANY booking with > 2 nights is forced into reservation mode.
    const shouldBeReservation = numberOfNights > 2;

    let requiresReservation = booking.requiresReservation;
    let reservationAmount = booking.reservationAmount;
    let remainingAmount = booking.remainingAmount;

    // Force the values based on the check above
    if (shouldBeReservation) {
      requiresReservation = true;
      // Force $30 if not set
      reservationAmount = 30; 

      // Calculate remaining amount (Total Price - Reservation)
      const totalPrice = booking.selectedRoomPriceUSDC || booking.stay.priceUSDC;
      // Ensure total price is valid (fallback to nightly * nights if missing)
      const calculatedTotal = totalPrice || (booking.stay.priceUSDC * numberOfNights);
      
      remainingAmount = calculatedTotal - reservationAmount;
    } else {
      // Force full payment mode if <= 2 nights
      requiresReservation = false;
    }

    // Determine the amount the user pays NOW
    // If reservation: Pay $30. If not: Pay Full Price.
    const paymentAmount = requiresReservation 
      ? reservationAmount! 
      : (booking.selectedRoomPriceUSDC || booking.stay.priceUSDC);

    console.log(`[Approve] Nights: ${numberOfNights}`);
    console.log(`[Approve] Mode: ${requiresReservation ? 'Reservation ($30)' : 'Full Payment'}`);
    console.log(`[Approve] Payment Amount User Must Pay: $${paymentAmount}`);

    // -------------------------------------------------------------

    // 4. Set expiry time
    const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

    // 5. Update booking to PENDING (And save the corrected logic variables to DB)
    // This ensures the Dashboard/Payment page sees the new correct data.
    const updatedBooking = await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.PENDING,
        expiresAt: expiresAt,
        // ✅ UPDATE DATABASE with recalculated values
        requiresReservation: requiresReservation,
        reservationAmount: reservationAmount,
        remainingAmount: remainingAmount,
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
          isReservation: requiresReservation,
          paymentAmount: paymentAmount,
        },
      },
    });

    // 7. Send Email
    const paymentUrl = `/booking/${bookingId}`;
    let emailSent = false;
    let emailError = null;

    try {
      const fullAmount = booking.selectedRoomPriceUSDC || booking.stay.priceUSDC;
      
      await sendApprovalEmail({
        recipientEmail: booking.user.email!,
        recipientName: booking.user.displayName || "Guest",
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        startDate: booking.stay.startDate,
        endDate: booking.stay.endDate,
        paymentAmount: paymentAmount, // This will now correctly be 30 if reservation
        paymentToken: "USDC/USDT",
        paymentUrl,
        expiresAt,
        // ✅ Pass the calculated boolean
        isReservation: requiresReservation, 
        numberOfNights: numberOfNights,
        fullAmount: fullAmount,
      });

      emailSent = true;
      console.log(`[API] Approval email sent to ${booking.user.email}`);
    } catch (error: any) {
      console.error("[API] Failed to send approval email:", error);
      emailError = error.message || "Unknown email error";
    }

    // 8. Return Response
    const successMessage = requiresReservation
      ? `Booking approved! User needs to pay $${paymentAmount} reservation.`
      : `Booking approved! User needs to pay full amount ($${paymentAmount}).`;

    return NextResponse.json({
      success: true,
      message: successMessage,
      emailSent: emailSent,
      emailError: emailError,
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
        expiresAt: updatedBooking.expiresAt,
        paymentLink: `/booking/${bookingId}`,
        // Return updated values
        isReservation: requiresReservation,
        reservationAmount: reservationAmount,
        remainingAmount: remainingAmount,
        numberOfNights: booking.numberOfNights,
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