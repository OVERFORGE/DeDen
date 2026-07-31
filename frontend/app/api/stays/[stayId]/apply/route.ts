// File: app/api/stays/[stayId]/apply/route.ts
// ✅ Server-authoritative pricing (lib/pricing.ts), full multi-guest
// persistence, and wallet-optional apply (a placeholder zero-address is no
// longer accepted or stored).
// ✅ Goes straight to PENDING (not WAITLISTED) — matches the payment page,
// which redirects here immediately after apply. A fresh PENDING booking
// gets a 24h payment window so it's eligible for lazy expiry.
// ✅ EXTEND: re-applying while a booking already exists for this stay no
// longer hard-blocks with 409 (unless a payment is actively verifying).
// Instead the newly submitted guest(s) are ADDED to the existing booking:
//   - WAITLISTED/PENDING (nothing paid yet): merge guests in place, recompute
//     price, keep the same status.
//   - RESERVED (reservation paid, remaining outstanding): merge guests, add
//     the extra cost onto the existing remainingAmount.
//   - CONFIRMED (fully paid): merge guests, open a fresh "remaining due" leg
//     for just the incremental cost — reuses the reservation/remaining-leg
//     UI and payment flow the frontend already has, so no frontend change
//     is needed to pay the top-up.
// Extra slots for the added guests are held immediately (and checked for
// availability) the same way the original reservation flow does.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeBookingTotals, incrementReferralUsage, PricingError } from '@/lib/pricing';
import { hasAvailableSlots, holdStaySlots } from '@/lib/inventory';
import { z } from 'zod';
import { firstValidationMessage } from '@/lib/validate';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_PAYMENT_WINDOW_HOURS = 24;

const ACTIVE_NON_TERMINAL_STATUSES: BookingStatus[] = [
  BookingStatus.WAITLISTED,
  BookingStatus.PENDING,
  BookingStatus.RESERVED,
  BookingStatus.CONFIRMED,
];

const guestSchema = z.object({
  fullName: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  age: z.union([z.string(), z.number()]).optional().default(''),
  gender: z.string().trim().optional().default(''),
  country: z.string().trim().optional().default(''),
  profession: z.string().trim().optional().default(''),
  xHandle: z.string().trim().optional().default(''),
  telegram: z.string().trim().optional().default(''),
});

const applyBodySchema = z.object({
  walletAddress: z.string().trim().optional(),
  email: z.string().trim().min(1, 'Email is required'),
  displayName: z.string().trim().min(1, 'Name is required'),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  role: z.string().trim().optional(),
  gender: z.string().trim().min(1, 'Gender is required'),
  age: z.union([z.string(), z.number()]),
  mobileNumber: z.string().trim().min(1, 'Mobile number is required'),
  selectedRoomId: z.string().trim().optional(),
  numberOfNights: z.union([z.string(), z.number()]),
  checkInDate: z.string().trim().min(1),
  checkOutDate: z.string().trim().min(1),
  socialTwitter: z.string().trim().optional(),
  socialTelegram: z.string().trim().optional(),
  socialLinkedin: z.string().trim().optional(),
  referralCode: z.string().trim().optional(),
  guests: z.array(guestSchema).min(1, 'At least one guest is required'),
});

/**
 * Apply for a stay with referral code, loyalty discount, multi-guest, and
 * reservation system support.
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

    if (!stayId || stayId === 'undefined') {
      return NextResponse.json(
        { error: 'A valid stayId is required in the URL' },
        { status: 400 }
      );
    }

    // 2. Validate body shape
    const rawBody = await request.json();
    const parsed = applyBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationMessage(parsed.error, 'Invalid request body') },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const age = Number(body.age);

    if (!age || age < 18) {
      return NextResponse.json(
        { error: 'You must be at least 18 years old to apply' },
        { status: 400 }
      );
    }

    // Guest 1 is the primary contact — full details required. Others just
    // need a name (matches what the apply UI actually collects).
    const [primaryGuest] = body.guests;
    if (!primaryGuest?.fullName || !primaryGuest?.email || !primaryGuest?.phone) {
      return NextResponse.json(
        { error: 'Guest 1 requires full name, email, and phone' },
        { status: 400 }
      );
    }

    const submittedGuestCount = body.guests.length;

    // Wallet is optional at apply time — reject the placeholder zero
    // address rather than persisting it as a real wallet.
    const walletAddress =
      body.walletAddress && body.walletAddress.toLowerCase() !== ZERO_ADDRESS
        ? body.walletAddress
        : null;

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

    // ── Dates & nights are resolved SERVER-SIDE ────────────────────────────
    //
    // ⚠️ Nights multiply the price in computeBookingTotals(), so they can
    // never be taken from the client. Previously `numberOfNights` was trusted
    // as sent, which meant a guest could POST `numberOfNights: 1` against a
    // 12-night fixed stay and be charged a twelfth of the real price.
    //
    //   • Fixed stays (default): the whole event window, full stop. Anything
    //     the client sent for dates/nights is ignored.
    //   • Flexible stays: the guest picks a range, but it must sit inside
    //     [startDate, endDate] — and nights are DERIVED from those dates
    //     rather than accepted as a separate number.
    const stayStart = new Date(stay.startDate);
    const stayEnd = new Date(stay.endDate);
    const MS_PER_NIGHT = 1000 * 60 * 60 * 24;

    const stayDuration =
      stay.duration || Math.ceil((stayEnd.getTime() - stayStart.getTime()) / MS_PER_NIGHT);

    let checkInDate = stayStart;
    let checkOutDate = stayEnd;
    let numberOfNights = stayDuration;

    if (stay.allowFlexibleDates) {
      const requestedIn = new Date(body.checkInDate);
      const requestedOut = new Date(body.checkOutDate);

      if (Number.isNaN(requestedIn.getTime()) || Number.isNaN(requestedOut.getTime())) {
        return NextResponse.json(
          { error: 'Please choose a valid check-in and check-out date' },
          { status: 400 }
        );
      }

      if (requestedOut.getTime() <= requestedIn.getTime()) {
        return NextResponse.json(
          { error: 'Check-out must be after check-in' },
          { status: 400 }
        );
      }

      // Compare on day boundaries so a time component can't push a valid
      // date just outside the window.
      const dayOf = (d: Date) => Math.floor(d.getTime() / MS_PER_NIGHT);
      if (dayOf(requestedIn) < dayOf(stayStart) || dayOf(requestedOut) > dayOf(stayEnd)) {
        return NextResponse.json(
          {
            error: `Dates must fall between ${stayStart.toDateString()} and ${stayEnd.toDateString()}`,
          },
          { status: 400 }
        );
      }

      // Mandatory core: if the organiser marked certain nights as required
      // (the conference days themselves), the chosen range has to cover all
      // of them. Guests may still arrive early and/or leave late.
      if (stay.coreStartDate && stay.coreEndDate) {
        const coreStart = new Date(stay.coreStartDate);
        const coreEnd = new Date(stay.coreEndDate);

        if (dayOf(requestedIn) > dayOf(coreStart) || dayOf(requestedOut) < dayOf(coreEnd)) {
          return NextResponse.json(
            {
              error: `This stay requires you to be booked for ${coreStart.toDateString()} to ${coreEnd.toDateString()}. You can arrive earlier or leave later, but your dates must cover those nights.`,
            },
            { status: 400 }
          );
        }
      }

      checkInDate = requestedIn;
      checkOutDate = requestedOut;
      numberOfNights = Math.max(1, Math.round((requestedOut.getTime() - requestedIn.getTime()) / MS_PER_NIGHT));
    }

    if (!numberOfNights || numberOfNights < 1) {
      return NextResponse.json(
        { error: 'This stay has an invalid date range configured' },
        { status: 400 }
      );
    }

    // 5. Update the authenticated user's profile from the form.
    //
    // NOTE: `email` is deliberately NOT written here. It is the account's
    // identity (established by the Google sign-in) — letting a booking form
    // silently rewrite it meant typing a different contact address on an
    // application changed the address you log in / receive everything with.
    // The per-booking contact address lives on `Booking.guestEmail` instead,
    // and that's what transactional mail for this booking is sent to.
    const user = await db.user.update({
      where: { id: userId },
      data: {
        displayName: body.displayName,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        gender: body.gender,
        age,
        mobileNumber: body.mobileNumber,
        socialTwitter: body.socialTwitter,
        socialTelegram: body.socialTelegram,
        socialLinkedin: body.socialLinkedin,
        ...(walletAddress ? { walletAddress } : {}),
      },
    });

    // Contact address for THIS booking — what the guest actually typed.
    const bookingContactEmail = primaryGuest.email || body.email || user.email;

    // 6. Check for an existing booking for this stay
    const existingBooking = await db.booking.findFirst({
      where: { userId: user.id, stayId: stay.id },
    });

    const isExtendable = !!existingBooking && ACTIVE_NON_TERMINAL_STATUSES.includes(existingBooking.status);

    // Block only when a payment is actively mid-verification — extending
    // while a tx is in flight would race with that confirmation.
    if (existingBooking?.status === BookingStatus.PENDING && existingBooking.txHash) {
      return NextResponse.json(
        {
          error: 'A payment for this booking is currently being verified. Please wait for it to complete before adding more guests.',
          bookingId: existingBooking.bookingId,
          status: existingBooking.status,
        },
        { status: 409 }
      );
    }

    // Combined guest list: existing guests (if extending) + newly submitted.
    const existingGuests = isExtendable ? ((existingBooking!.guests as any[]) || []) : [];
    const combinedGuests = [...existingGuests, ...body.guests];
    const combinedGuestCount = combinedGuests.length;
    const previousGuestCount = existingGuests.length;
    const addedGuestCount = combinedGuestCount - previousGuestCount;

    // 4. Server-authoritative pricing for the FULL (combined) guest count.
    // Referral codes are only honored on a brand-new or terminal-status
    // booking — an extension doesn't re-consume/re-validate one.
    let pricing;
    try {
      pricing = await computeBookingTotals({
        stay: {
          id: stay.id,
          priceUSDC: stay.priceUSDC,
          priceUSDT: stay.priceUSDT,
          rooms: stay.rooms,
          requiresReservation: stay.requiresReservation,
          reservationAmount: stay.reservationAmount,
          minNightsForReservation: stay.minNightsForReservation,
          loyaltyDiscountEnabled: stay.loyaltyDiscountEnabled,
        },
        roomId: body.selectedRoomId || existingBooking?.selectedRoomId || null,
        nights: numberOfNights,
        guestCount: combinedGuestCount,
        referralCode: isExtendable ? null : body.referralCode || null,
        userId,
      });
    } catch (err) {
      if (err instanceof PricingError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    console.log(`[Apply] ${isExtendable ? 'Extending' : 'New'} — guests: ${combinedGuestCount} (+${addedGuestCount}) | nights: ${numberOfNights} | discount: ${pricing.discountPercent}%`);

    const paymentWindowExpiresAt = new Date(Date.now() + DEFAULT_PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);
    let resultBooking;
    let extensionDelta: number | null = null;

    if (isExtendable && existingBooking) {
      // Extra slots are claimed the moment the extension is requested, same
      // as the initial reservation flow claims a slot before the remaining
      // leg is paid.
      if (addedGuestCount > 0 && (existingBooking.status === BookingStatus.RESERVED || existingBooking.status === BookingStatus.CONFIRMED)) {
        const slotsOk = await hasAvailableSlots(stay.id, addedGuestCount);
        if (!slotsOk) {
          return NextResponse.json(
            { error: `Not enough slots remaining for ${addedGuestCount} additional guest(s).` },
            { status: 409 }
          );
        }
      }

      const sharedFields = {
        numberOfNights,
        checkInDate,
        checkOutDate,
        pricePerNightUSDC: pricing.pricePerNightUSDC,
        pricePerNightUSDT: pricing.pricePerNightUSDT,
        originalPrice: pricing.subtotalUSDC,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmountUSDC,
        finalPrice: pricing.finalTotalUSDC,
        isLoyaltyDiscount: pricing.isLoyaltyDiscount,
        selectedRoomPriceUSDC: pricing.finalTotalUSDC,
        selectedRoomPriceUSDT: pricing.finalTotalUSDT,
        selectedRoomName: pricing.roomName,
        guestCount: combinedGuestCount,
        guests: combinedGuests as any,
      };

      if (existingBooking.status === BookingStatus.WAITLISTED || existingBooking.status === BookingStatus.PENDING) {
        // Nothing paid yet — just merge in place, recompute price, keep status.
        resultBooking = await db.booking.update({
          where: { id: existingBooking.id },
          data: {
            ...sharedFields,
            requiresReservation: pricing.requiresReservation,
            reservationAmount: pricing.reservationAmount,
            remainingAmount: pricing.remainingAmountUSDC,
            remainingDueDate: pricing.requiresReservation ? checkInDate : null,
            expiresAt: paymentWindowExpiresAt,
            // Clear any stale payment lock so it's recomputed against the new total.
            paymentToken: null,
            paymentAmount: null,
            amountBaseUnits: null,
            chainId: null,
            txHash: null,
            senderAddress: null,
          },
        });
      } else if (existingBooking.status === BookingStatus.RESERVED) {
        // Reservation already paid; the extra cost is added to the
        // still-outstanding remaining amount.
        extensionDelta = parseFloat((pricing.finalTotalUSDC - (existingBooking.finalPrice ?? 0)).toFixed(2));
        const newRemaining = parseFloat(((existingBooking.remainingAmount ?? 0) + extensionDelta).toFixed(2));

        if (addedGuestCount > 0) {
          await holdStaySlots(stay.id, addedGuestCount);
        }

        resultBooking = await db.booking.update({
          where: { id: existingBooking.id },
          data: {
            ...sharedFields,
            requiresReservation: true,
            reservationAmount: existingBooking.reservationAmount,
            remainingAmount: newRemaining,
          },
        });
      } else {
        // CONFIRMED — fully paid already. Open a fresh "remaining due" leg
        // for just the incremental cost, reusing the existing
        // reservation/remaining-payment UI and lock-payment/submit-payment
        // flow so no frontend change is needed to collect the top-up.
        const previousTotalPaid = existingBooking.totalPaid ?? existingBooking.finalPrice ?? existingBooking.selectedRoomPriceUSDC ?? 0;
        extensionDelta = parseFloat((pricing.finalTotalUSDC - previousTotalPaid).toFixed(2));

        if (extensionDelta <= 0) {
          return NextResponse.json(
            { error: 'Could not compute a positive amount due for the added guest(s).' },
            { status: 400 }
          );
        }

        if (addedGuestCount > 0) {
          await holdStaySlots(stay.id, addedGuestCount);
        }

        resultBooking = await db.booking.update({
          where: { id: existingBooking.id },
          data: {
            ...sharedFields,
            status: BookingStatus.RESERVED,
            requiresReservation: true,
            reservationPaid: true,
            remainingPaid: false,
            remainingAmount: extensionDelta,
            remainingDueDate: new Date(),
            remainingTxHash: null,
            remainingToken: null,
            remainingChainId: null,
          },
        });
      }
    } else {
      // Fresh booking — either no prior booking, or the prior one is in a
      // terminal state (FAILED/EXPIRED/CANCELLED/REFUNDED) and this is a
      // clean re-application, not an extension.
      const commonBookingFields = {
        preferredRoomId: body.selectedRoomId || null,
        selectedRoomId: body.selectedRoomId || null,
        numberOfNights,
        checkInDate,
        checkOutDate,
        pricePerNightUSDC: pricing.pricePerNightUSDC,
        pricePerNightUSDT: pricing.pricePerNightUSDT,
        originalPrice: pricing.subtotalUSDC,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmountUSDC,
        finalPrice: pricing.finalTotalUSDC,
        isLoyaltyDiscount: pricing.isLoyaltyDiscount,
        referralCodeId: pricing.validatedReferralCode?.id || null,
        referralCodeUsed: pricing.validatedReferralCode?.code || null,
        selectedRoomPriceUSDC: pricing.finalTotalUSDC,
        selectedRoomPriceUSDT: pricing.finalTotalUSDT,
        selectedRoomName: pricing.roomName,
        guestCount: submittedGuestCount,
        guests: body.guests as any,
        requiresReservation: pricing.requiresReservation,
        reservationAmount: pricing.reservationAmount,
        remainingAmount: pricing.remainingAmountUSDC,
        remainingDueDate: pricing.requiresReservation ? checkInDate : null,
        expiresAt: paymentWindowExpiresAt,
      };

      if (existingBooking) {
        resultBooking = await db.booking.update({
          where: { id: existingBooking.id },
          data: {
            status: BookingStatus.PENDING,
            ...commonBookingFields,
            guestName: user.displayName,
            guestEmail: bookingContactEmail,
            guestGender: body.gender,
            guestAge: age,
            guestMobile: body.mobileNumber,
            reservationPaid: false,
            remainingPaid: false,
            paymentToken: null,
            paymentAmount: null,
            amountBaseUnits: null,
            chainId: null,
            txHash: null,
            senderAddress: null,
            confirmedAt: null,
          },
        });
      } else {
        resultBooking = await db.booking.create({
          data: {
            bookingId: `${stayId}-${Date.now()}`,
            status: BookingStatus.PENDING,
            userId: user.id,
            stayId: stay.id,
            guestName: user.displayName,
            guestEmail: bookingContactEmail,
            guestGender: body.gender,
            guestAge: age,
            guestMobile: body.mobileNumber,
            ...commonBookingFields,
            reservationPaid: false,
            remainingPaid: false,
            optInGuestList: false,
            shareContactInfo: false,
            contentReuseConsent: false,
            needsTravelHelp: false,
          },
        });
      }

      if (pricing.validatedReferralCode) {
        await incrementReferralUsage(pricing.validatedReferralCode.id);
      }
    }

    // 7. Log Activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        bookingId: resultBooking.id,
        action: isExtendable ? 'booking_extended' : (existingBooking ? 'application_resubmitted' : 'application_submitted'),
        entity: 'booking',
        entityId: resultBooking.id,
        details: {
          stayId: stay.stayId,
          email: user.email,
          walletAddress,
          selectedRoomId: body.selectedRoomId,
          selectedRoomName: pricing.roomName,
          numberOfNights,
          previousGuestCount,
          addedGuestCount,
          guestCount: combinedGuestCount,
          checkInDate,
          checkOutDate,
          finalPrice: pricing.finalTotalUSDC,
          extensionDelta,
          requiresReservation: pricing.requiresReservation,
        },
      },
    });

    // 8. Respond
    let responseMessage: string;
    if (isExtendable && extensionDelta !== null) {
      responseMessage = `Added ${addedGuestCount} guest(s)! An extra $${extensionDelta} is due — you'll be taken to pay it.`;
    } else if (isExtendable) {
      responseMessage = `Added ${addedGuestCount} guest(s) to your application.`;
    } else {
      responseMessage = pricing.requiresReservation
        ? `Application submitted! ${pricing.discountPercent > 0 ? `${pricing.discountPercent}% discount applied.` : ''} Reservation payment ($${pricing.reservationAmount}) required.`
        : `Application submitted successfully! ${pricing.discountPercent > 0 ? `${pricing.discountPercent}% discount applied.` : ''}`;
    }

    return NextResponse.json(
      {
        success: true,
        message: responseMessage,
        booking: {
          bookingId: resultBooking.bookingId,
          status: resultBooking.status,
          nextAction: 'PROCEED_TO_PAYMENT',
          stayTitle: stay.title,
          selectedRoomName: pricing.roomName,
          numberOfNights,
          guestCount: combinedGuestCount,
          checkInDate,
          checkOutDate,
          finalPriceUSDC: pricing.finalTotalUSDC,
          finalPriceUSDT: pricing.finalTotalUSDT,
          discountType: pricing.discountType,
          requiresReservation: resultBooking.requiresReservation,
          reservationAmount: resultBooking.reservationAmount,
          remainingAmount: resultBooking.remainingAmount,
          extensionDelta,
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
