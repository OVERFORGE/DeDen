// File: lib/pricing.ts
// Single source of truth for booking price math. Used by apply, admin
// approve, and lock-payment so a price is never computed twice (and never
// trusted from the client).

import { db } from "@/lib/database";
import { BookingStatus, ReferralCode } from "@prisma/client";

export class PricingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface PricingStayInput {
  id: string;
  priceUSDC: number;
  priceUSDT: number;
  rooms: unknown;
  requiresReservation: boolean;
  reservationAmount: number | null;
  minNightsForReservation: number | null;
  loyaltyDiscountEnabled: boolean;
}

export interface ComputeBookingTotalsInput {
  stay: PricingStayInput;
  roomId?: string | null;
  nights: number;
  guestCount: number;
  referralCode?: string | null;
  userId: string;
}

export interface ComputeBookingTotalsResult {
  roomName: string | null;
  pricePerNightUSDC: number;
  pricePerNightUSDT: number;

  subtotalUSDC: number;
  subtotalUSDT: number;

  discountPercent: number;
  isLoyaltyDiscount: boolean;
  discountType: "Loyalty (20%)" | `Referral (${number}%)` | "None";

  discountAmountUSDC: number;
  discountAmountUSDT: number;

  finalTotalUSDC: number;
  finalTotalUSDT: number;

  requiresReservation: boolean;
  reservationAmount: number | null;
  remainingAmountUSDC: number | null;
  remainingAmountUSDT: number | null;

  validatedReferralCode: ReferralCode | null;
}

const LOYALTY_DISCOUNT_PERCENT = 20;

export interface ReservationSplitInput {
  stay: Pick<PricingStayInput, "requiresReservation" | "reservationAmount" | "minNightsForReservation">;
  nights: number;
  finalTotalUSDC: number;
  finalTotalUSDT: number;
}

export interface ReservationSplitResult {
  requiresReservation: boolean;
  reservationAmount: number | null;
  remainingAmountUSDC: number | null;
  remainingAmountUSDT: number | null;
}

/**
 * Derives the reservation/remaining split from an already-known final total.
 * Used at approve time, where the discount has already been locked in at
 * apply time and must not be recomputed (that would risk re-evaluating loyalty
 * status or losing a referral discount that isn't re-supplied here).
 */
export function computeReservationSplit(input: ReservationSplitInput): ReservationSplitResult {
  const minNights = input.stay.minNightsForReservation ?? 2;
  const requiresReservation = Boolean(input.stay.requiresReservation) && input.nights >= minNights;
  const reservationAmount = requiresReservation ? input.stay.reservationAmount ?? 30 : null;

  let remainingAmountUSDC: number | null = null;
  let remainingAmountUSDT: number | null = null;
  if (requiresReservation && reservationAmount !== null) {
    remainingAmountUSDC = parseFloat((input.finalTotalUSDC - reservationAmount).toFixed(2));
    remainingAmountUSDT = parseFloat((input.finalTotalUSDT - reservationAmount).toFixed(2));
  }

  return { requiresReservation, reservationAmount, remainingAmountUSDC, remainingAmountUSDT };
}

/**
 * Computes the full, authoritative price breakdown for a booking.
 * guestCount multiplies the per-night rate — pricing is per-head, not per-room.
 */
export async function computeBookingTotals(
  input: ComputeBookingTotalsInput
): Promise<ComputeBookingTotalsResult> {
  const { stay, roomId, nights, guestCount, referralCode, userId } = input;

  if (!Number.isFinite(nights) || nights < 1) {
    throw new PricingError(400, "Invalid number of nights");
  }
  if (!Number.isFinite(guestCount) || guestCount < 1) {
    throw new PricingError(400, "Invalid guest count");
  }

  // 1. Resolve per-night price (room override or stay default)
  let pricePerNightUSDC = stay.priceUSDC;
  let pricePerNightUSDT = stay.priceUSDT;
  let roomName: string | null = null;

  if (roomId) {
    const rooms = (stay.rooms as any[]) || [];
    const selectedRoom = rooms.find((r: any) => r.id === roomId);
    if (!selectedRoom) {
      throw new PricingError(400, "Selected room not found for this stay");
    }
    pricePerNightUSDC = selectedRoom.priceUSDC ?? stay.priceUSDC;
    pricePerNightUSDT = selectedRoom.priceUSDT ?? stay.priceUSDT;
    roomName = selectedRoom.name ?? null;
  }

  if (typeof pricePerNightUSDC !== "number" || typeof pricePerNightUSDT !== "number") {
    throw new PricingError(500, "Could not determine a price for this stay");
  }

  // 2. Subtotal = rate * nights * guests (server-authoritative — the client
  //    number is never trusted).
  const subtotalUSDC = pricePerNightUSDC * nights * guestCount;
  const subtotalUSDT = pricePerNightUSDT * nights * guestCount;

  // 3. Loyalty discount — 20% for anyone with a prior CONFIRMED booking,
  //    unless this specific stay has opted out of loyalty pricing.
  const previousBookings = stay.loyaltyDiscountEnabled
    ? await db.booking.count({ where: { userId, status: BookingStatus.CONFIRMED } })
    : 0;
  const loyaltyDiscountPercent = previousBookings > 0 ? LOYALTY_DISCOUNT_PERCENT : 0;

  // 4. Referral discount — validated against this stay.
  let validatedReferralCode: ReferralCode | null = null;
  let referralDiscountPercent = 0;

  if (referralCode && referralCode.trim()) {
    const referral = await db.referralCode.findFirst({
      where: {
        code: referralCode.trim().toUpperCase(),
        stayId: stay.id,
        isActive: true,
      },
    });

    if (!referral) {
      throw new PricingError(404, "Invalid referral code for this stay");
    }
    if (referral.expiresAt && new Date(referral.expiresAt) < new Date()) {
      throw new PricingError(410, "This referral code has expired");
    }
    if (referral.maxUsage && referral.usageCount >= referral.maxUsage) {
      throw new PricingError(410, "This referral code has reached its usage limit");
    }

    validatedReferralCode = referral;
    referralDiscountPercent = referral.discountPercent;
  }

  // 5. Loyalty (20%) beats referral (typically 10%) when both apply.
  const discountPercent = Math.max(loyaltyDiscountPercent, referralDiscountPercent);
  const isLoyaltyDiscount = discountPercent === loyaltyDiscountPercent && loyaltyDiscountPercent > 0;

  const discountAmountUSDC = (subtotalUSDC * discountPercent) / 100;
  const discountAmountUSDT = (subtotalUSDT * discountPercent) / 100;

  const finalTotalUSDC = subtotalUSDC - discountAmountUSDC;
  const finalTotalUSDT = subtotalUSDT - discountAmountUSDT;

  // 6. Reservation split (2+ nights flows), when enabled on the stay.
  const { requiresReservation, reservationAmount, remainingAmountUSDC, remainingAmountUSDT } =
    computeReservationSplit({ stay, nights, finalTotalUSDC, finalTotalUSDT });

  const discountType: ComputeBookingTotalsResult["discountType"] = isLoyaltyDiscount
    ? "Loyalty (20%)"
    : validatedReferralCode
    ? (`Referral (${referralDiscountPercent}%)` as const)
    : "None";

  return {
    roomName,
    pricePerNightUSDC,
    pricePerNightUSDT,
    subtotalUSDC,
    subtotalUSDT,
    discountPercent,
    isLoyaltyDiscount,
    discountType,
    discountAmountUSDC,
    discountAmountUSDT,
    finalTotalUSDC,
    finalTotalUSDT,
    requiresReservation,
    reservationAmount,
    remainingAmountUSDC,
    remainingAmountUSDT,
    validatedReferralCode,
  };
}

/**
 * Call after a booking referencing validatedReferralCode is successfully
 * created/updated, to increment usage count exactly once.
 */
export async function incrementReferralUsage(referralCodeId: string) {
  await db.referralCode.update({
    where: { id: referralCodeId },
    data: { usageCount: { increment: 1 } },
  });
}

/**
 * Gives a referral-code use back when the booking that consumed it reaches a
 * terminal state (expired, cancelled, refunded). Without this, abandoned
 * applications permanently burn slots against a code's `maxUsage` — a
 * community code capped at 50 could be exhausted by 50 people who never paid.
 *
 * Clamped at 0 so repeated/duplicate releases can't drive the count negative.
 */
export async function releaseReferralUsage(referralCodeId: string) {
  const code = await db.referralCode.findUnique({
    where: { id: referralCodeId },
    select: { usageCount: true },
  });
  if (!code || code.usageCount <= 0) return;

  await db.referralCode.update({
    where: { id: referralCodeId },
    data: { usageCount: { decrement: 1 } },
  });
}
