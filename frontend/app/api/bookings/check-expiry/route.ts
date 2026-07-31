// File: app/api/bookings/check-expiry/route.ts
// ✅ NEW: Cron job or scheduled task to check expired bookings

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { sendPaymentExpiryEmail } from '@/lib/email';
import { requireAdminOrJob, authErrorResponse } from '@/lib/api-auth';
import { releaseStaySlots } from '@/lib/inventory';
import { releaseReferralUsage } from '@/lib/pricing';

/**
 * POST /api/bookings/check-expiry
 * Checks for expired bookings and sends emails.
 * Callable from the admin panel, or by an external scheduler using
 * `Authorization: Bearer JOB_SECRET` (no Vercel Cron available yet — see
 * lib/booking-lifecycle.ts for the per-read lazy check that covers the
 * common case without needing a scheduler at all).
 */
export async function POST(request: Request) {
  try {
    await requireAdminOrJob(request);

    const now = new Date();

    // Two kinds of stale booking (mirrors lib/booking-lifecycle.ts):
    //   1. PENDING past its payment window — never held a slot.
    //   2. RESERVED whose stay has ENDED with the balance never paid — the
    //      deposit is holding a slot that's now stranded forever. Keyed off
    //      stay.endDate rather than the balance due date (= check-in) so we
    //      never cancel a guest who plans to settle up on arrival.
    const expiredBookings = await db.booking.findMany({
      where: {
        OR: [
          { status: BookingStatus.PENDING, expiresAt: { lte: now } },
          {
            status: BookingStatus.RESERVED,
            remainingPaid: false,
            stay: { is: { endDate: { lt: now } } },
          },
        ],
      },
      include: {
        user: true,
        stay: true,
      },
    });

    console.log(`[Expiry Check] Found ${expiredBookings.length} expired bookings`);

    const results = [];

    for (const booking of expiredBookings) {
      try {
        // Only a RESERVED booking was actually holding inventory — a PENDING
        // one never got as far as a paid deposit.
        const wasHoldingSlots = booking.status === BookingStatus.RESERVED;

        // Update status to EXPIRED
        await db.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.EXPIRED,
          },
        });

        if (wasHoldingSlots) {
          await releaseStaySlots(booking.stayId, booking.guestCount || 1);
        }

        // Give the referral-code use back — this booking never completed.
        if (booking.referralCodeId) {
          await releaseReferralUsage(booking.referralCodeId);
        }

        // Log activity
        await db.activityLog.create({
          data: {
            bookingId: booking.id,
            userId: booking.userId,
            action: 'payment_expired',
            entity: 'booking',
            entityId: booking.id,
            details: {
              expiredAt: now,
              wasReservation: booking.requiresReservation,
              reason: wasHoldingSlots
                ? 'reservation_balance_never_paid_stay_ended'
                : 'payment_window_elapsed',
              slotsReleased: wasHoldingSlots ? booking.guestCount || 1 : 0,
            },
          },
        });

        // Send expiry email
        if (booking.user?.email) {
          try {
            await sendPaymentExpiryEmail({
              recipientEmail: booking.guestEmail || booking.user.email,
              recipientName: booking.user.displayName || 'Guest',
              bookingId: booking.bookingId,
              stayTitle: booking.stay.title,
              wasReservation: booking.requiresReservation,
            });

            results.push({
              bookingId: booking.bookingId,
              status: 'expired',
              emailSent: true,
            });
          } catch (emailError) {
            console.error(`[Expiry Check] Failed to send email for ${booking.bookingId}:`, emailError);
            results.push({
              bookingId: booking.bookingId,
              status: 'expired',
              emailSent: false,
              emailError: (emailError as Error).message,
            });
          }
        }
      } catch (error) {
        console.error(`[Expiry Check] Error processing booking ${booking.bookingId}:`, error);
        results.push({
          bookingId: booking.bookingId,
          status: 'error',
          error: (error as Error).message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: expiredBookings.length,
      results,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[Expiry Check] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}