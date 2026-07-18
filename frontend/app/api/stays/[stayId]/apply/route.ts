// File: app/api/stays/[stayId]/apply/route.ts
// ✅ UPDATED: Added reservation system for 2+ nights bookings

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
/**
 * Apply for a stay with referral code, loyalty discount, and reservation system support
 * POST /api/stays/[stayId]/apply
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ stayId: string }> }
) {
  try {
    // 1. Get Authenticated Session
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = session.user.id;

    const { stayId } = await context.params;
    const body = await request.json();

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
      numberOfNights,
      checkInDate,
      checkOutDate,
      socialTwitter,
      socialTelegram,
      socialLinkedin,
      referralCode,
    } = body;

    // 2. Validation
    if (!stayId || stayId === 'undefined') {
      return NextResponse.json(
        { error: 'A valid stayId is required in the URL' },
        { status: 400 }
      );
    }

    if (!walletAddress || !gender || !age || !mobileNumber || !email || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (age < 18) {
      return NextResponse.json(
        { error: 'You must be at least 18 years old to apply' },
        { status: 400 }
      );
    }

    if (!numberOfNights || numberOfNights < 1) {
      return NextResponse.json(
        { error: 'Please select at least 1 night' },
        { status: 400 }
      );
    }

    if (!checkInDate || !checkOutDate) {
      return NextResponse.json(
        { error: 'Please select check-in and check-out dates' },
        { status: 400 }
      );
    }

    // 3. Find the Stay
    const stay = await db.stay.findUnique({
      where: { stayId: stayId },
    });

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

    // Validate nights
    const stayDuration = stay.duration || Math.ceil(
      (new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (numberOfNights > stayDuration) {
      return NextResponse.json(
        { error: `Cannot book more than ${stayDuration} nights for this stay` },
        { status: 400 }
      );
    }

    // ✅ NEW: Check if booking requires reservation (2+ nights)
    const requiresReservation = stay.requiresReservation && 
      numberOfNights >= (stay.minNightsForReservation || 2);
    
const reservationAmount = requiresReservation 
  ? (stay.reservationAmount ?? 30) 
  : null;
    console.log(`[Apply] Booking requires reservation: ${requiresReservation}`);
    if (requiresReservation) {
      console.log(`[Apply] Reservation amount: $${reservationAmount}`);
    }

    // 4. CHECK LOYALTY DISCOUNT (20% for returning customers)
    const previousBookings = await db.booking.count({
      where: {
        userId: userId,
        status: BookingStatus.CONFIRMED,
      },
    });

    const isLoyaltyEligible = previousBookings > 0;
    let loyaltyDiscountPercent = isLoyaltyEligible ? 20 : 0;

    console.log(`[Apply] User has ${previousBookings} previous confirmed bookings`);
    console.log(`[Apply] Loyalty discount: ${loyaltyDiscountPercent}%`);

    // 5. VALIDATE REFERRAL CODE (10% discount)
    let validatedReferralCode = null;
    let referralDiscountPercent = 0;

    if (referralCode && referralCode.trim()) {
      const referral = await db.referralCode.findFirst({
        where: {
          code: referralCode.trim().toUpperCase(),
          stayId: stay.id,
          isActive: true,
        },
      });

      if (referral) {
        if (referral.expiresAt && new Date(referral.expiresAt) < new Date()) {
          return NextResponse.json(
            { error: 'This referral code has expired' },
            { status: 410 }
          );
        }

        if (referral.maxUsage && referral.usageCount >= referral.maxUsage) {
          return NextResponse.json(
            { error: 'This referral code has reached its usage limit' },
            { status: 410 }
          );
        }

        validatedReferralCode = referral;
        referralDiscountPercent = referral.discountPercent;
        console.log(`[Apply] Valid referral code: ${referral.code} (${referralDiscountPercent}%)`);
      } else {
        return NextResponse.json(
          { error: 'Invalid referral code for this stay' },
          { status: 404 }
        );
      }
    }

    // 6. CALCULATE FINAL DISCOUNT (Loyalty 20% > Referral 10%)
    const finalDiscountPercent = Math.max(loyaltyDiscountPercent, referralDiscountPercent);
    const isLoyaltyDiscount = finalDiscountPercent === loyaltyDiscountPercent && loyaltyDiscountPercent > 0;

    console.log(`[Apply] Final discount applied: ${finalDiscountPercent}% (${isLoyaltyDiscount ? 'Loyalty' : 'Referral'})`);

    // 7. CALCULATE PRICES WITH DISCOUNT
    let pricePerNightUSDC: number | null = null;
    let pricePerNightUSDT: number | null = null;
    let originalTotalUSDC: number | null = null;
    let originalTotalUSDT: number | null = null;
    let finalTotalUSDC: number | null = null;
    let finalTotalUSDT: number | null = null;
    let discountAmountUSDC: number | null = null;
    let discountAmountUSDT: number | null = null;
    let roomName: string | null = null;

    if (selectedRoomId) {
      const rooms = (stay.rooms as any[]) || [];
      const selectedRoom = rooms.find((r: any) => r.id === selectedRoomId);

      if (selectedRoom) {
        pricePerNightUSDC = selectedRoom.priceUSDC ?? stay.priceUSDC;
        pricePerNightUSDT = selectedRoom.priceUSDT ?? stay.priceUSDT;
        roomName = selectedRoom.name;
      }
    } else {
      pricePerNightUSDC = stay.priceUSDC;
      pricePerNightUSDT = stay.priceUSDT;
    }

    if (typeof pricePerNightUSDC !== 'number' || typeof pricePerNightUSDT !== 'number') {
      return NextResponse.json({ error: "Could not determine price" }, { status: 500 });
    }

    // Calculate original totals
    originalTotalUSDC = pricePerNightUSDC * numberOfNights;
    originalTotalUSDT = pricePerNightUSDT * numberOfNights;

    // Calculate discount amounts
    discountAmountUSDC = (originalTotalUSDC * finalDiscountPercent) / 100;
    discountAmountUSDT = (originalTotalUSDT * finalDiscountPercent) / 100;

    // Calculate final prices
    finalTotalUSDC = originalTotalUSDC - discountAmountUSDC;
    finalTotalUSDT = originalTotalUSDT - discountAmountUSDT;

    console.log(`[Apply] Original: $${originalTotalUSDC} USDC / $${originalTotalUSDT} USDT`);
    console.log(`[Apply] Discount: -$${discountAmountUSDC} USDC / -$${discountAmountUSDT} USDT (${finalDiscountPercent}%)`);
    console.log(`[Apply] Final: $${finalTotalUSDC} USDC / $${finalTotalUSDT} USDT`);

    // ✅ NEW: Calculate remaining amount if reservation is required
    let remainingAmountUSDC: number | null = null;
    let remainingAmountUSDT: number | null = null;
    
    if (requiresReservation && reservationAmount) {
      remainingAmountUSDC = finalTotalUSDC - reservationAmount;
      remainingAmountUSDT = finalTotalUSDT - reservationAmount;
      
      console.log(`[Apply] Reservation: $${reservationAmount}`);
      console.log(`[Apply] Remaining: $${remainingAmountUSDC} USDC / $${remainingAmountUSDT} USDT`);
    }

    // 8. Get & Update Authenticated User
    const emailConflict = await db.user.findFirst({
      where: {
        email: email,
        id: { not: userId },
      },
    });

    if (emailConflict) {
      return NextResponse.json(
        { error: 'This email is already registered with another account.' },
        { status: 409 }
      );
    }

    const user = await db.user.update({
      where: { id: userId },
      data: {
        displayName,
        email,
        firstName,
        lastName,
        role,
        gender,
        age,
        mobileNumber,
        socialTwitter,
        socialTelegram,
        socialLinkedin,
        walletAddress,
      },
    });

    // 9. Check for existing booking
    const existingBooking = await db.booking.findFirst({
      where: {
        userId: user.id,
        stayId: stay.id,
      },
      select: {
        id: true,
        bookingId: true,
        status: true,
      },
    });

    if (existingBooking) {
      const isTerminalStatus =
        existingBooking.status === BookingStatus.FAILED ||
        existingBooking.status === BookingStatus.EXPIRED ||
        existingBooking.status === BookingStatus.CANCELLED ||
        existingBooking.status === BookingStatus.REFUNDED;

      if (isTerminalStatus) {
        // Update old booking
        const updatedBooking = await db.booking.update({
          where: { id: existingBooking.id },
          data: {
            status: BookingStatus.WAITLISTED,
            preferredRoomId: selectedRoomId || null,
            selectedRoomId: selectedRoomId || null,
            numberOfNights,
            checkInDate: new Date(checkInDate),
            checkOutDate: new Date(checkOutDate),
            pricePerNightUSDC,
            pricePerNightUSDT,
            originalPrice: originalTotalUSDC,
            discountPercent: finalDiscountPercent,
            discountAmount: discountAmountUSDC,
            finalPrice: finalTotalUSDC,
            isLoyaltyDiscount,
            referralCodeId: validatedReferralCode?.id || null,
            referralCodeUsed: validatedReferralCode?.code || null,
            selectedRoomPriceUSDC: finalTotalUSDC,
            selectedRoomPriceUSDT: finalTotalUSDT,
            selectedRoomName: roomName,
            // ✅ NEW: Reservation fields
            requiresReservation: requiresReservation,
            reservationAmount: reservationAmount,
            remainingAmount: remainingAmountUSDC,
            reservationPaid: false,
            remainingPaid: false,
            remainingDueDate: requiresReservation ? new Date(checkInDate) : null,
            // Reset payment fields
            guestName: user.displayName,
            guestEmail: user.email,
            guestGender: gender,
            guestAge: age,
            guestMobile: mobileNumber,
            paymentToken: null,
            paymentAmount: null,
            txHash: null,
            chainId: null,
            expiresAt: null,
            confirmedAt: null,
          },
        });

        if (validatedReferralCode) {
          await db.referralCode.update({
            where: { id: validatedReferralCode.id },
            data: { usageCount: { increment: 1 } },
          });
        }

        return NextResponse.json(
          {
            success: true,
            message: finalDiscountPercent > 0 
              ? `Application re-submitted with ${finalDiscountPercent}% discount!`
              : 'Application re-submitted successfully!',
            booking: {
              bookingId: updatedBooking.bookingId,
              status: updatedBooking.status,
              stayTitle: stay.title,
              selectedRoomName: roomName,
              numberOfNights,
              checkInDate,
              checkOutDate,
              originalPrice: originalTotalUSDC,
              discountPercent: finalDiscountPercent,
              discountAmount: discountAmountUSDC,
              finalPriceUSDC: finalTotalUSDC,
              finalPriceUSDT: finalTotalUSDT,
              discountType: isLoyaltyDiscount ? 'Loyalty (20%)' : validatedReferralCode ? `Referral (${referralDiscountPercent}%)` : 'None',
              requiresReservation,
              reservationAmount,
              remainingAmount: remainingAmountUSDC,
            },
          },
          { status: 201 }
        );
      } else {
        return NextResponse.json(
          {
            error: `You have an active application for this stay. Status: ${existingBooking.status}`,
            bookingId: existingBooking.bookingId,
            status: existingBooking.status,
          },
          { status: 409 }
        );
      }
    }

    // 10. Create NEW Booking
    const randomId = `${stayId}-${Date.now()}`;

    const newBooking = await db.booking.create({
      data: {
        bookingId: randomId,
        status: BookingStatus.WAITLISTED,
        userId: user.id,
        stayId: stay.id,
        guestName: user.displayName,
        guestEmail: user.email,
        guestGender: gender,
        guestAge: age,
        guestMobile: mobileNumber,
        preferredRoomId: selectedRoomId || null,
        selectedRoomId: selectedRoomId || null,
        numberOfNights,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        pricePerNightUSDC,
        pricePerNightUSDT,
        originalPrice: originalTotalUSDC,
        discountPercent: finalDiscountPercent,
        discountAmount: discountAmountUSDC,
        finalPrice: finalTotalUSDC,
        isLoyaltyDiscount,
        referralCodeId: validatedReferralCode?.id || null,
        referralCodeUsed: validatedReferralCode?.code || null,
        selectedRoomPriceUSDC: finalTotalUSDC,
        selectedRoomPriceUSDT: finalTotalUSDT,
        selectedRoomName: roomName,
        // ✅ NEW: Reservation fields
        requiresReservation: requiresReservation,
        reservationAmount: reservationAmount,
        remainingAmount: remainingAmountUSDC,
        reservationPaid: false,
        remainingPaid: false,
        remainingDueDate: requiresReservation ? new Date(checkInDate) : null,
        guestCount: 1,
        optInGuestList: false,
        shareContactInfo: false,
        contentReuseConsent: false,
        needsTravelHelp: false,
      },
    });

    if (validatedReferralCode) {
      await db.referralCode.update({
        where: { id: validatedReferralCode.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // 11. Log Activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        bookingId: newBooking.id,
        action: 'application_submitted',
        entity: 'booking',
        entityId: newBooking.id,
        details: {
          stayId: stay.stayId,
          email: user.email,
          walletAddress,
          selectedRoomId,
          selectedRoomName: roomName,
          numberOfNights,
          checkInDate,
          checkOutDate,
          originalPrice: originalTotalUSDC,
          discountPercent: finalDiscountPercent,
          discountAmount: discountAmountUSDC,
          finalPrice: finalTotalUSDC,
          discountType: isLoyaltyDiscount ? 'loyalty' : 'referral',
          referralCode: validatedReferralCode?.code,
          requiresReservation,
          reservationAmount,
          remainingAmount: remainingAmountUSDC,
        },
      },
    });

    // 12. Return Success
    const responseMessage = requiresReservation
      ? `Application submitted! ${finalDiscountPercent > 0 ? `${finalDiscountPercent}% discount applied.` : ''} Reservation payment ($${reservationAmount}) required.`
      : `Application submitted successfully! ${finalDiscountPercent > 0 ? `${finalDiscountPercent}% discount applied.` : ''}`;

    return NextResponse.json(
      {
        success: true,
        message: responseMessage,
        booking: {
          bookingId: newBooking.bookingId,
          status: newBooking.status,
          stayTitle: stay.title,
          selectedRoomName: roomName,
          numberOfNights,
          checkInDate,
          checkOutDate,
          originalPrice: originalTotalUSDC,
          discountPercent: finalDiscountPercent,
          discountAmount: discountAmountUSDC,
          finalPriceUSDC: finalTotalUSDC,
          finalPriceUSDT: finalTotalUSDT,
          discountType: isLoyaltyDiscount ? 'Loyalty (20%)' : validatedReferralCode ? `Referral (${referralDiscountPercent}%)` : 'None',
          requiresReservation,
          reservationAmount,
          remainingAmount: remainingAmountUSDC,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[Apply API Error]:', error);

    if ((error as any).name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data provided to database' },
        { status: 400 }
      );
    }

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