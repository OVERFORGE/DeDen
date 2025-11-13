import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus, UserRole } from '@prisma/client';

/**
 * Apply for a stay (join waitlist) - WITH ROOM PRICING
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
      gender,
      age,
      mobileNumber,
      selectedRoomId,
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

    if (!walletAddress || !email || !displayName || !gender || !age || !mobileNumber) {
      console.error('[API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, email, displayName, gender, age, mobileNumber' },
        { status: 400 }
      );
    }

    if (age < 18) {
      return NextResponse.json(
        { error: 'You must be at least 18 years old to apply' },
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

    // 🆕 3. --- FIND SELECTED ROOM & GET PRICE ---
    let roomPrice: number | null = null;
    let roomName: string | null = null;

    if (selectedRoomId) {
      // Rooms are stored as JSON array in Stay
      const rooms = (stay.rooms as any[]) || [];
      const selectedRoom = rooms.find((r: any) => r.id === selectedRoomId);
      
      if (selectedRoom) {
        roomPrice = selectedRoom.price;
        roomName = selectedRoom.name;
        console.log('[API] User selected room:', roomName, 'at $', roomPrice);
      } else {
        console.warn('[API] Room ID not found in stay. Using stay base price.');
      }
    }

    // 4. --- Find or Create User ---
    let user = await db.user.findUnique({
      where: { walletAddress: walletAddress },
    });

    if (user) {
      const updateData: any = {
        displayName: displayName,
        firstName: firstName,
        lastName: lastName,
        role: role,
        gender: gender,
        age: age,
        mobileNumber: mobileNumber,
        socialTwitter: socialTwitter,
        socialTelegram: socialTelegram,
        socialLinkedin: socialLinkedin,
      };

      if (user.email !== email) {
        const emailConflict = await db.user.findFirst({
          where: {
            email: email,
            id: { not: user.id },
          },
        });

        if (!emailConflict) {
          updateData.email = email;
        } else {
          console.log('[API] Email already in use by another user, skipping email update');
        }
      }

      user = await db.user.update({
        where: { walletAddress: walletAddress },
        data: updateData,
      });
      
      console.log('[API] User updated:', user.displayName);
    } else {
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

      user = await db.user.create({
        data: {
          walletAddress: walletAddress,
          email: email,
          displayName: displayName,
          firstName: firstName,
          lastName: lastName,
          role: role,
          gender: gender,
          age: age,
          mobileNumber: mobileNumber,
          socialTwitter: socialTwitter,
          socialTelegram: socialTelegram,
          socialLinkedin: socialLinkedin,
          userRole: UserRole.GUEST,
        },
      });
      
      console.log('[API] User created:', user.displayName);
    }

    // 5. --- Check for Duplicate Application ---
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

    // 🆕 6. --- Create WAITLISTED Booking WITH ROOM DATA ---
    const randomId = `${stayId}-${Date.now()}`;

    const newBooking = await db.booking.create({
      data: {
        bookingId: randomId,
        status: BookingStatus.WAITLISTED,
        userId: user.id,
        stayId: stay.id,
        guestName: displayName,
        guestEmail: email,
        guestGender: gender,
        guestAge: age,
        guestMobile: mobileNumber,
        preferredRoomId: selectedRoomId || null,
        selectedRoomId: selectedRoomId || null,
        selectedRoomPrice: roomPrice, // 🆕 STORE ROOM PRICE
        selectedRoomName: roomName,   // 🆕 STORE ROOM NAME
        guestCount: 1,
        optInGuestList: false,
      },
    });

    console.log('[API] Booking created:', newBooking.bookingId);

    // 7. --- Log Activity ---
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
          gender: gender,
          age: age,
          mobileNumber: mobileNumber,
          selectedRoomId: selectedRoomId,
          selectedRoomName: roomName,
          selectedRoomPrice: roomPrice,
        },
      },
    });

    // 8. --- Return Success ---
    return NextResponse.json(
      {
        success: true,
        message: 'Application submitted successfully. Check your dashboard for status updates.',
        booking: {
          bookingId: newBooking.bookingId,
          status: newBooking.status,
          stayTitle: stay.title,
          selectedRoomName: roomName,
          selectedRoomPrice: roomPrice,
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