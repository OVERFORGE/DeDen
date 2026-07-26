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

/**
 * Checks a single booking by bookingId and expires it if it's PENDING and
 * past its expiresAt. Safe to call on every read — no-ops otherwise.
 */
export async function settleBookingIfStale(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { bookingId },
    include: { user: true, stay: true },
  });

  if (!booking) return;
  if (booking.status !== BookingStatus.PENDING) return;
  if (!booking.expiresAt || booking.expiresAt.getTime() > Date.now()) return;

  await db.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.EXPIRED },
  });

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
        source: 'lazy-settlement',
      },
    },
  });

  if (booking.user?.email) {
    try {
      await sendPaymentExpiryEmail({
        recipientEmail: booking.user.email,
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
