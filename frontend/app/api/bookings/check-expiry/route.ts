// File: app/api/bookings/check-expiry/route.ts
// ✅ NEW: Cron job or scheduled task to check expired bookings

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { sendPaymentExpiryEmail } from '@/lib/email';

/**
 * POST /api/bookings/check-expiry
 * Checks for expired bookings and sends emails
 * Should be called by a cron job every 5-10 minutes
 */
export async function POST(request: Request) {
  try {
    const now = new Date();
    
    // Find all PENDING bookings that have expired
    const expiredBookings = await db.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: {
          lte: now,
        },
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
        // Update status to EXPIRED
        await db.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.EXPIRED,
          },
        });

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
            },
          },
        });

        // Send expiry email
        if (booking.user?.email) {
          try {
            await sendPaymentExpiryEmail({
              recipientEmail: booking.user.email,
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
    console.error('[Expiry Check] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}