// File: app/api/admin/bookings/[bookingId]/approve/route.ts
// ✅ requireAdmin guard (this route had zero server-side auth before).
// ✅ Reservation split now goes through lib/pricing.ts instead of inline
//    math duplicated across this file.
// ✅ Guards against overbooking — refuses to approve if the stay no longer
//    has enough open slots for this booking's guest count.

import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/database";
import { BookingStatus } from "@prisma/client";
import { sendApprovalEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";
import { requireAdmin, authErrorResponse } from "@/lib/api-auth";
import { computeReservationSplit } from "@/lib/pricing";
import { checkRangeAvailability } from "@/lib/inventory";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    await requireAdmin();

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

    // ✅ Overbooking guard — the stay may have filled up since this
    // application was submitted. Checked per-night, over the range this
    // booking actually occupies, not the whole stay window.
    const guestCount = booking.guestCount || 1;
    const range = await checkRangeAvailability(
      booking.stayId,
      guestCount,
      booking.checkInDate ?? booking.stay.startDate,
      booking.checkOutDate ?? booking.stay.endDate
    );
    if (!range.ok) {
      return NextResponse.json(
        {
          error: `Not enough slots remaining for this stay (need ${guestCount}${
            range.conflictNight ? ` on ${range.conflictNight}` : ''
          }, only ${range.availableOnConflict ?? 0} free).`,
        },
        { status: 409 }
      );
    }

    const numberOfNights = booking.numberOfNights || 0;

    // Final total was already computed (with discount) at apply time.
    const finalTotalUSDC = booking.selectedRoomPriceUSDC ?? booking.stay.priceUSDC * numberOfNights;
    const finalTotalUSDT = booking.selectedRoomPriceUSDT ?? booking.stay.priceUSDT * numberOfNights;

    const { requiresReservation, reservationAmount, remainingAmountUSDC } = computeReservationSplit({
      stay: {
        requiresReservation: booking.stay.requiresReservation,
        reservationAmount: booking.stay.reservationAmount,
        minNightsForReservation: booking.stay.minNightsForReservation,
      },
      nights: numberOfNights,
      finalTotalUSDC,
      finalTotalUSDT,
    });

    const remainingAmount = remainingAmountUSDC;

    // Amount the guest must pay right now.
    const paymentAmount = requiresReservation ? reservationAmount! : finalTotalUSDC;

    console.log(`[Approve] Stay has reservation enabled: ${booking.stay.requiresReservation}`);
    console.log(`[Approve] Booking nights: ${numberOfNights}, guests: ${guestCount}`);
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
          guestCount,
        },
      },
    });

    // Send Email
    const paymentUrl = `/booking/${bookingId}`;
    let emailSent = false;
    let emailError = null;

    try {
      await sendApprovalEmail({
        recipientEmail: (booking.guestEmail || booking.user.email)!,
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
        fullAmount: finalTotalUSDC,
      });

      emailSent = true;
      console.log(`[API] Approval email sent to ${booking.user.email}`);
    } catch (error: any) {
      console.error("[API] Failed to send approval email:", error);
      emailError = error.message || "Unknown email error";
    }

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
        isReservation: requiresReservation,
        reservationAmount: reservationAmount,
        remainingAmount: remainingAmount,
        numberOfNights: booking.numberOfNights,
      },
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error("[API] Error approving booking:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
