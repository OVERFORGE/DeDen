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

    // 3. --- Find or Create User (wallet-based identity) ---
    let user = await db.user.findUnique({
      where: { walletAddress: walletAddress },
    });

    if (user) {
      // ✅ FIX: Only update fields that won't cause unique constraint violations
      // Don't update email if it would conflict with another user
      const updateData: any = {
        displayName: displayName,
        firstName: firstName,
        lastName: lastName,
        role: role,
        socialTwitter: socialTwitter,
        socialTelegram: socialTelegram,
        socialLinkedin: socialLinkedin,
      };

      // Only update email if it's different AND doesn't conflict
      if (user.email !== email) {
        // Check if this email is already used by another user
        const emailConflict = await db.user.findFirst({
          where: {
            email: email,
            id: { not: user.id }, // Exclude current user
          },
        });

        if (!emailConflict) {
          // Safe to update email
          updateData.email = email;
        } else {
          console.log('[API] Email already in use by another user, skipping email update');
          // Don't update email, but continue with the application
        }
      }

      user = await db.user.update({
        where: { walletAddress: walletAddress },
        data: updateData,
      });
      
      console.log('[API] User updated:', user.displayName);
    } else {
      // New user - check if email is already taken
      const existingEmailUser = await db.user.findUnique({
        where: { email: email },
      });

      if (existingEmailUser) {
        return NextResponse.json(
          { 
            error: 'This email is already registered with another wallet. Please use a different email or sign in with your existing account.',
          },
          { status: 409 }
        );
      }

      // Create new user
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

    // 4. --- Check for Duplicate Application ---
    const existingBooking = await db.booking.findFirst({
      where: {
        userId: user.id,
        stayId: stay.id,
      },
    });

    if (existingBooking) {
      console.log('[API] Duplicate booking found:', existingBooking.bookingId);
      return NextResponse.json(
        {
          error: 'You have already applied for this stay. Check your dashboard for status.',
          bookingId: existingBooking.bookingId,
          status: existingBooking.status,
        },
        { status: 409 }
      );
    }

    // 5. --- Create the WAITLISTED Booking ---
    const randomId = `${stayId}-${Date.now()}`;

    const newBooking = await db.booking.create({
      data: {
        bookingId: randomId,
        status: BookingStatus.WAITLISTED,
        userId: user.id,
        stayId: stay.id,
        guestName: displayName,
        guestEmail: email,
        optInGuestList: false,
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
          walletAddress: walletAddress,
        },
      },
    });

    // 7. --- Return Success ---
    return NextResponse.json(
      {
        success: true,
        message: 'Application submitted successfully. Check your dashboard for status updates.',
        booking: {
          bookingId: newBooking.bookingId,
          status: newBooking.status,
          stayTitle: stay.title,
        },
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

    // Handle unique constraint errors
    if ((error as any).code === 'P2002') {
      const meta = (error as any).meta;
      if (meta?.target?.includes('email')) {
        return NextResponse.json(
          { error: 'This email is already registered. Please use a different email or sign in.' },
          { status: 409 }
        );
      }
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