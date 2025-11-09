// File: app/api/admin/approve-booking/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { sendApprovalEmail } from '@/lib/email';
import { PrismaClient, BookingStatus } from '@prisma/client'

const prisma = new PrismaClient();

/**
 * Admin endpoint to approve a booking and send payment link to user
 * POST /api/admin/approve-booking
 * 
 * Body: { bookingId: string, paymentExpiryHours?: number }
 */
export async function POST(request: Request) {
  try {
    // 1. Parse request body
    const body = await request.json();
    const { bookingId, paymentExpiryHours = 24 } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
        { status: 400 }
      );
    }

    // 2. TODO: Add authentication check here
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // 3. Find the booking with related user and stay data
    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            walletAddress: true,
          },
        },
        stay: {
          select: {
            title: true,
            location: true,
            startDate: true,
            endDate: true,
            priceUSDC: true,
            priceUSDT: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // 4. Validate current status
    if (booking.status !== BookingStatus.WAITLISTED) {
      return NextResponse.json(
        { 
          error: `Cannot approve booking with status: ${booking.status}`,
          currentStatus: booking.status 
        },
        { status: 400 }
      );
    }

    // 5. Check if user has email
    if (!booking.user.email) {
      return NextResponse.json(
        { error: 'User does not have an email address' },
        { status: 400 }
      );
    }

    // 6. Calculate payment expiry
    const expiresAt = new Date(Date.now() + paymentExpiryHours * 60 * 60 * 1000);

    // 7. Update booking status to PENDING with expiry
    const updatedBooking = await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.PENDING,
        expiresAt,
      },
    });

    // 8. Create activity log
    await db.activityLog.create({
      data: {
        userId: booking.user.id,
        bookingId: booking.id,
        action: 'booking_approved',
        entity: 'booking',
        entityId: booking.id,
        details: {
          approvedBy: 'admin', // TODO: Replace with actual admin ID
          previousStatus: BookingStatus.WAITLISTED,
          newStatus: BookingStatus.PENDING,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    // 9. Send approval email with payment link
    const paymentUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/booking/${bookingId}`;
    
    try {
      await sendApprovalEmail({
        recipientEmail: booking.user.email,
        recipientName: booking.user.displayName || 'Guest',
        bookingId: booking.bookingId,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        startDate: booking.stay.startDate,
        endDate: booking.stay.endDate,
        priceUSDC: booking.stay.priceUSDC,
        priceUSDT: booking.stay.priceUSDT,
        paymentUrl,
        expiresAt,
      });

      console.log(`[ADMIN] Approval email sent to ${booking.user.email} for booking ${bookingId}`);
    } catch (emailError) {
      console.error('[ADMIN] Failed to send approval email:', emailError);
      // Don't fail the entire request if email fails
      // The booking is still approved, admin can manually notify user
    }

    // 10. Return success response
    return NextResponse.json({
      success: true,
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
        expiresAt: updatedBooking.expiresAt,
        paymentUrl,
      },
      message: 'Booking approved successfully. Payment link sent to user.',
    });

  } catch (error) {
    console.error('[ADMIN] Error approving booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get booking details for admin review
 * GET /api/admin/approve-booking?bookingId=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId parameter is required' },
        { status: 400 }
      );
    }

    // TODO: Add authentication check

    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
            walletAddress: true,
            role: true,
            bio: true,
            socialTwitter: true,
            socialTelegram: true,
          },
        },
        stay: {
          select: {
            title: true,
            location: true,
            startDate: true,
            endDate: true,
            priceUSDC: true,
            priceUSDT: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ booking });

  } catch (error) {
    console.error('[ADMIN] Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}