import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus, UserRole } from '@prisma/client';

/**
 * Apply for a stay (join waitlist)
 * POST /api/stays/[stayId]/apply
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ stayId: string }> }
) {
  try {
    // IMPORTANT: In Next.js 15+, params is now a Promise
    const { stayId } = await context.params;
    
    console.log('[API] Received stayId from URL:', stayId);
    
    const body = await request.json();
    console.log('[API] Received body:', body);

    const {
      walletAddress,
      email,
      displayName,
      firstName,
      lastName,
      role,
      socialTwitter,
      socialTelegram,
      socialLinkedin,
    } = body;

    // 1. --- Validation ---
    if (!stayId || stayId === 'undefined') {
      console.error('[API] Invalid stayId:', stayId);
      return NextResponse.json(
        { error: 'A valid stayId is required in the URL' },
        { status: 400 }
      );
    }

    // Check for required fields from the form body
    if (!walletAddress || !email || !displayName) {
      console.error('[API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, email, displayName' },
        { status: 400 }
      );
    }

    // 2. --- Find the Stay ---
    const stay = await db.stay.findUnique({
      where: { stayId: stayId },
    });

    console.log('[API] Found stay:', stay?.title || 'NOT FOUND');

    if (!stay) {
      return NextResponse.json(
        { error: `Stay with ID '${stayId}' not found` },
        { status: 404 }
      );
    }

    if (!stay.allowWaitlist) {
      return NextResponse.json(
        { error: 'This stay is not accepting applications' },
        { status: 400 }
      );
    }

    // 3. --- Find or Create User (wallet-based identity only) ---
    // ✅ Only check by wallet address - email is no longer unique
    let user = await db.user.findUnique({
      where: { walletAddress: walletAddress },
    });

    if (user) {
      // User exists - update their info (email can be different per event)
      user = await db.user.update({
        where: { walletAddress: walletAddress },
        data: {
          // Update user info - email can change per event application
          email: email,
          displayName: displayName,
          firstName: firstName,
          lastName: lastName,
          role: role,
          socialTwitter: socialTwitter,
          socialTelegram: socialTelegram,
          socialLinkedin: socialLinkedin,
        },
      });
      
      console.log('[API] User updated:', user.displayName);
    } else {
      // New user - create with wallet-based identity
      user = await db.user.create({
        data: {
          walletAddress: walletAddress,
          email: email,
          displayName: displayName,
          firstName: firstName,
          lastName: lastName,
          role: role,
          socialTwitter: socialTwitter,
          socialTelegram: socialTelegram,
          socialLinkedin: socialLinkedin,
          userRole: UserRole.GUEST,
        },
      });
      
      console.log('[API] User created:', user.displayName);
    }

    // 4. --- Check for Duplicate Application (same wallet, same stay) ---
    // ✅ This uses the compound unique constraint @@unique([userId, stayId])
    const existingBooking = await db.booking.findFirst({
      where: {
        userId: user.id,
        stayId: stay.id,
      },
    });

    if (existingBooking) {
      return NextResponse.json(
        {
          error: 'You have already applied for this stay',
          bookingId: existingBooking.bookingId,
          status: existingBooking.status,
        },
        { status: 409 }
      );
    }

    // 5. --- Create the WAITLISTED Booking (awaiting admin approval) ---
    const randomId = `${stayId}-${Date.now()}`;

    // ✅ Create booking in WAITLISTED status (no payment details yet)
    const newBooking = await db.booking.create({
      data: {
        bookingId: randomId,
        status: BookingStatus.WAITLISTED, // ✅ Changed back to WAITLISTED
        userId: user.id,
        stayId: stay.id,
        guestName: displayName,
        guestEmail: email, // Email stored per event booking
        optInGuestList: false,
        // ❌ NO payment details - added after approval
      },
    });

    console.log('[API] Booking created:', newBooking.bookingId);

    // 6. --- Log Activity ---
    await db.activityLog.create({
      data: {
        userId: user.id,
        bookingId: newBooking.id,
        action: 'application_submitted',
        entity: 'booking',
        entityId: newBooking.id,
        details: {
          stayId: stay.stayId,
          email: email,
        },
      },
    });

    // 7. --- Return Success ---
    return NextResponse.json(
      {
        success: true,
        message: 'Application submitted successfully. Please proceed to payment.',
        booking: {
          bookingId: newBooking.bookingId,
          status: newBooking.status,
          stayTitle: stay.title,
          paymentAmount: newBooking.paymentAmount,
          paymentToken: newBooking.paymentToken,
          expiresAt: newBooking.expiresAt,
        },
        // Add payment link so frontend can redirect
        paymentLink: `/booking/${newBooking.bookingId}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error applying for stay:', error);
    
    if ((error as any).name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data provided to database' },
        { status: 400 }
      );
    }

    // Handle unique constraint errors (should only be for duplicate bookings now)
    if ((error as any).code === 'P2002') {
      return NextResponse.json(
        { error: 'You have already applied for this stay' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}