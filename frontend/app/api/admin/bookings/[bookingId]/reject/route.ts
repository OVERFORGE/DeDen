import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/database";
import { BookingStatus } from "@prisma/client";

/**
 * Reject a waitlisted booking
 * POST /api/admin/bookings/[bookingId]/reject
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;
    const body = await request.json();
    const { reason = "Application rejected by admin" } = body;

    // 1. Find the booking
    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: {
        stay: true,
        user: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // 2. Check if booking can be rejected
    if (booking.status !== BookingStatus.WAITLISTED) {
      return NextResponse.json(
        {
          error: `Cannot reject. Booking status is: ${booking.status}`,
          currentStatus: booking.status,
        },
        { status: 409 }
      );
    }

    // 3. Update booking to CANCELLED
    const updatedBooking = await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        // Store rejection reason in a metadata field if you have one
      },
    });

    // 4. Log activity
    await db.activityLog.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        action: "waitlist_rejected",
        entity: "booking",
        entityId: booking.id,
        details: {
          previousStatus: BookingStatus.WAITLISTED,
          newStatus: BookingStatus.CANCELLED,
          reason: reason,
        },
      },
    });

    // 5. Send rejection email (optional)
    let emailSent = false;
    let emailError = null;

    if (booking.user?.email) {
      try {
        // Import your email sending function
        // Example: await sendRejectionEmail({ ... })
        
        // For now, just log it
        console.log(
          `[API] Would send rejection email to ${booking.user.email} for booking ${bookingId}`
        );
        console.log(`[API] Reason: ${reason}`);
        
        // TODO: Implement sendRejectionEmail function
        // await sendRejectionEmail({
        //   recipientEmail: booking.user.email,
        //   recipientName: booking.user.displayName || "Guest",
        //   bookingId: booking.bookingId,
        //   stayTitle: booking.stay.title,
        //   reason: reason,
        // });

        emailSent = true;
      } catch (error: any) {
        console.error("[API] Failed to send rejection email:", error);
        emailError = error.message || "Unknown email error";
      }
    }

    // 6. Return Response
    return NextResponse.json({
      success: true,
      message: "Booking rejected successfully",
      emailSent: emailSent,
      emailError: emailError,
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
      },
    });
  } catch (error) {
    console.error("[API] Error rejecting booking:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}