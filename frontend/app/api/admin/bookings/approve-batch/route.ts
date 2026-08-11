// File: app/api/admin/bookings/approve-batch/route.ts
// ✅ Moved here from app/api/admin/bookings/[bookingId]/approve-batch/route.ts
//    — that path required a bookingId segment before "approve-batch", so
//    the frontend's call to /api/admin/bookings/approve-batch always 404'd.
// ✅ requireAdmin guard (had none before).
// ✅ Reservation split via lib/pricing.ts instead of always charging full
//    stay.priceUSDC regardless of nights/room/discount.
// ✅ Removed the hardcoded chain:'bsc'/chainId:97 pre-lock — chain/token are
//    chosen by the guest at payment time via /api/bookings/lock-payment,
//    same as the single-approve flow.
// ✅ Per-booking overbooking guard.

import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { sendApprovalEmail } from '@/lib/email';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { computeReservationSplit } from '@/lib/pricing';
import { checkRangeAvailability } from '@/lib/inventory';

/**
 * Batch approve multiple bookings
 * PATCH /api/admin/bookings/approve-batch
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { bookingIds, sessionExpiryMinutes = 15 } = body;

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

    for (const bookingId of bookingIds) {
      try {
        const booking = await db.booking.findUnique({
          where: { bookingId },
          include: {
            stay: true,
            user: { select: { email: true, displayName: true } },
          },
        });

        if (!booking || booking.status !== BookingStatus.WAITLISTED) {
          results.failed.push({ bookingId, error: 'Not found or not waitlisted' });
          continue;
        }

        if (!booking.user || !booking.user.email) {
          results.failed.push({ bookingId, error: 'User has no email' });
          continue;
        }

        const guestCount = booking.guestCount || 1;
        const range = await checkRangeAvailability(
          booking.stayId,
          guestCount,
          booking.checkInDate ?? booking.stay.startDate,
          booking.checkOutDate ?? booking.stay.endDate
        );
        if (!range.ok) {
          results.failed.push({
            bookingId,
            error: `Not enough slots remaining (need ${guestCount}${
              range.conflictNight ? ` on ${range.conflictNight}` : ''
            }, only ${range.availableOnConflict ?? 0} free)`,
          });
          continue;
        }

        const numberOfNights = booking.numberOfNights || 0;
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

        const paymentAmount = requiresReservation ? reservationAmount! : finalTotalUSDC;
        const expiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

        await db.booking.update({
          where: { bookingId },
          data: {
            status: BookingStatus.PENDING,
            expiresAt,
            requiresReservation,
            reservationAmount,
            remainingAmount: remainingAmountUSDC,
          },
        });

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
              expiresAt,
              isReservation: requiresReservation,
              paymentAmount,
              guestCount,
              via: 'batch',
            },
          },
        });

        const paymentUrl = `/booking/${bookingId}`;
        try {
          await sendApprovalEmail({
            recipientEmail: (booking.guestEmail || booking.user.email)!,
            recipientName: booking.user.displayName || 'Guest',
            bookingId: booking.bookingId,
            stayTitle: booking.stay.title,
            stayLocation: booking.stay.location,
            startDate: booking.stay.startDate,
            endDate: booking.stay.endDate,
            paymentAmount,
            paymentToken: 'USDC/USDT',
            paymentUrl,
            expiresAt,
            isReservation: requiresReservation,
            numberOfNights,
            fullAmount: finalTotalUSDC,
          });

          results.approved.push(bookingId);
        } catch (emailError: any) {
          console.error(`[API-BATCH] Failed to send email for ${bookingId}:`, emailError);
          results.failed.push({
            bookingId,
            error: `Booking approved but email failed: ${emailError.message}`,
          });
        }
      } catch (error) {
        results.failed.push({ bookingId, error: (error as Error).message });
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
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error batch approving bookings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
