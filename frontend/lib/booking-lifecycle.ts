// File: lib/booking-lifecycle.ts
// Lazy lifecycle settlement — runs inline whenever a booking is read, so
// correctness doesn't depend on a cron job (Vercel Cron needs a paid plan,
// which we don't have yet). A PENDING booking past its expiresAt is flipped
// to EXPIRED the moment anyone loads it, instead of sitting stale forever.
//
// This intentionally does NOT re-verify stuck transactions inline — a
// blockchain receipt that isn't mined yet is not a failure, and retrying
// aggressively on every page load risks marking a slow-but-valid payment as
// FAILED. Stuck-transaction reconciliation is handled by the explicit
// /api/jobs/reconcile-payments endpoint (admin-triggered or external
// scheduler), which uses verifyPayment's full retry/backoff logic.

import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { sendPaymentExpiryEmail } from '@/lib/email';
import { releaseStaySlots } from '@/lib/inventory';
import { releaseReferralUsage } from '@/lib/pricing';

/**
 * Checks a single booking by bookingId and expires it if it has gone stale.
 * Safe to call on every read — no-ops otherwise. Two cases:
 *
 *  1. PENDING past `expiresAt` — the payment window closed. No slot was
 *     ever held (slots are only held once money lands), so nothing to release.
 *
 *  2. RESERVED whose stay has already ENDED with the balance never paid —
 *     the deposit held a slot that is now permanently stranded. We release
 *     it here so future stays aren't starved of inventory.
 *
 *     Deliberately keyed off `stay.endDate`, NOT `remainingDueDate` (which
 *     equals the check-in date): auto-cancelling at the due date would boot
 *     guests who fully intend to settle their balance on arrival. Waiting
 *     until the event is over can never cancel a real attendee.
 */
export async function settleBookingIfStale(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { bookingId },
    include: { user: true, stay: true },
  });

  if (!booking) return;

  const now = Date.now();

  const isStalePending =
    booking.status === BookingStatus.PENDING &&
    !!booking.expiresAt &&
    booking.expiresAt.getTime() <= now;

  const isAbandonedReservation =
    booking.status === BookingStatus.RESERVED &&
    !booking.remainingPaid &&
    !!booking.stay?.endDate &&
    booking.stay.endDate.getTime() < now;

  if (!isStalePending && !isAbandonedReservation) return;

  await db.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.EXPIRED },
  });

  // Only a RESERVED booking was actually holding inventory.
  if (isAbandonedReservation) {
    await releaseStaySlots(booking.stayId, booking.guestCount || 1);
  }

  // Give the referral-code use back — this booking never completed.
  if (booking.referralCodeId) {
    await releaseReferralUsage(booking.referralCodeId);
  }

  await db.activityLog.create({
    data: {
      bookingId: booking.id,
      userId: booking.userId,
      action: 'payment_expired',
      entity: 'booking',
      entityId: booking.id,
      details: {
        expiredAt: new Date(),
        wasReservation: booking.requiresReservation,
        reason: isAbandonedReservation
          ? 'reservation_balance_never_paid_stay_ended'
          : 'payment_window_elapsed',
        slotsReleased: isAbandonedReservation ? booking.guestCount || 1 : 0,
        source: 'lazy-settlement',
      },
    },
  });

  if (booking.user?.email) {
    try {
      await sendPaymentExpiryEmail({
        recipientEmail: booking.guestEmail || booking.user.email,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        wasReservation: booking.requiresReservation,
      });
    } catch (emailError) {
      console.error('[Lifecycle] Failed to send expiry email:', emailError);
    }
  }
}
