// File: app/api/admin/bookings/[bookingId]/approve/route.ts
// ✅ FIXED: Uses '??' to allow small decimals like 0.001 instead of forcing 30

import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/database";
import { BookingStatus } from "@prisma/client";
import { sendApprovalEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";

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

    if (!booking.user || !booking.user.email) {
      return NextResponse.json(
        { error: "Booking has no user or user has no email." },
        { status: 400 }
      );
    }

    if (booking.status !== BookingStatus.WAITLISTED) {
      return NextResponse.json(
        {
          error: `Cannot approve. Booking status is: ${booking.status}`,
          currentStatus: booking.status,
        },
        { status: 409 }
      );
    }

    // ✅ FIXED: Use admin's stay configuration
    const numberOfNights = booking.numberOfNights || 0;
    const minNightsRequired = booking.stay.minNightsForReservation || 2;
    
    // Check if this stay has reservation system enabled AND meets minimum nights
    const shouldBeReservation = 
      booking.stay.requiresReservation && 
      numberOfNights >= minNightsRequired;

    let requiresReservation = shouldBeReservation;
    
    // ✅ CRITICAL FIX: Changed || to ?? so it respects 0.001
    let reservationAmount = shouldBeReservation 
      ? (booking.stay.reservationAmount ?? 30) 
      : null;
      
    let remainingAmount: number | null = null;

    if (shouldBeReservation) {
      const totalPrice = booking.selectedRoomPriceUSDC || booking.stay.priceUSDC;
      const calculatedTotal = totalPrice || (booking.stay.priceUSDC * numberOfNights);
      // Ensure floating point math doesn't create weird decimals like 29.99999999
      remainingAmount = parseFloat((calculatedTotal - (reservationAmount!)).toFixed(2));
    }

    // Determine payment amount user needs to pay now
    const paymentAmount = requiresReservation 
      ? reservationAmount! 
      : (booking.selectedRoomPriceUSDC || booking.stay.priceUSDC);

    console.log(`[Approve] Stay has reservation enabled: ${booking.stay.requiresReservation}`);
    console.log(`[Approve] Min nights required: ${minNightsRequired}`);
    console.log(`[Approve] Booking nights: ${numberOfNights}`);
    console.log(`[Approve] Mode: ${requiresReservation ? `Reservation ($${reservationAmount})` : 'Full Payment'}`);
    console.log(`[Approve] Payment Amount: $${paymentAmount}`);

    // Set expiry time
    const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

    // Update booking to PENDING
    const updatedBooking = await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.PENDING,
        expiresAt: expiresAt,
        requiresReservation: requiresReservation,
        reservationAmount: reservationAmount,
        remainingAmount: remainingAmount,
      },
    });

    // Log activity
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
          stayReservationSettings: {
            enabled: booking.stay.requiresReservation,
            minNights: minNightsRequired,
            amount: booking.stay.reservationAmount,
          },
        },
      },
    });

    // Send Email
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
        paymentAmount: paymentAmount,
        paymentToken: "USDC/USDT",
        paymentUrl,
        expiresAt,
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

    const successMessage = requiresReservation
      ? `Booking approved! User needs to pay $${paymentAmount} reservation (${numberOfNights} nights ≥ ${minNightsRequired} min nights).`
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