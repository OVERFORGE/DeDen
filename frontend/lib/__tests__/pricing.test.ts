import { describe, it, expect, vi, beforeEach } from "vitest";

const bookingCount = vi.fn();
const referralCodeFindFirst = vi.fn();

vi.mock("@/lib/database", () => ({
  db: {
    booking: { count: (...args: any[]) => bookingCount(...args) },
    referralCode: { findFirst: (...args: any[]) => referralCodeFindFirst(...args) },
  },
}));

const { computeBookingTotals, computeReservationSplit, PricingError } = await import("@/lib/pricing");

const baseStay = {
  id: "stay-1",
  priceUSDC: 100,
  priceUSDT: 100,
  rooms: [],
  requiresReservation: true,
  reservationAmount: 30,
  minNightsForReservation: 2,
};

beforeEach(() => {
  bookingCount.mockReset();
  referralCodeFindFirst.mockReset();
});

describe("computeReservationSplit", () => {
  it("requires no reservation below the minimum-nights threshold", () => {
    const result = computeReservationSplit({
      stay: baseStay,
      nights: 1,
      finalTotalUSDC: 100,
      finalTotalUSDT: 100,
    });
    expect(result.requiresReservation).toBe(false);
    expect(result.reservationAmount).toBeNull();
  });

  it("splits reservation + remaining once nights meet the threshold", () => {
    const result = computeReservationSplit({
      stay: baseStay,
      nights: 3,
      finalTotalUSDC: 300,
      finalTotalUSDT: 300,
    });
    expect(result.requiresReservation).toBe(true);
    expect(result.reservationAmount).toBe(30);
    expect(result.remainingAmountUSDC).toBe(270);
    expect(result.remainingAmountUSDT).toBe(270);
  });

  it("defaults reservationAmount to 30 when the stay doesn't set one", () => {
    const result = computeReservationSplit({
      stay: { ...baseStay, reservationAmount: null },
      nights: 3,
      finalTotalUSDC: 300,
      finalTotalUSDT: 300,
    });
    expect(result.reservationAmount).toBe(30);
  });
});

describe("computeBookingTotals", () => {
  it("multiplies rate x nights x guestCount with no discount for a first-time guest", async () => {
    bookingCount.mockResolvedValue(0);
    const result = await computeBookingTotals({
      stay: baseStay,
      nights: 2,
      guestCount: 3,
      userId: "user-1",
    });
    expect(result.subtotalUSDC).toBe(600); // 100 * 2 * 3
    expect(result.discountPercent).toBe(0);
    expect(result.finalTotalUSDC).toBe(600);
  });

  it("applies a flat 20% loyalty discount for a returning guest", async () => {
    bookingCount.mockResolvedValue(2);
    const result = await computeBookingTotals({
      stay: baseStay,
      nights: 2,
      guestCount: 1,
      userId: "user-1",
    });
    expect(result.discountPercent).toBe(20);
    expect(result.isLoyaltyDiscount).toBe(true);
    expect(result.finalTotalUSDC).toBe(160); // 200 - 20%
  });

  it("applies a referral discount for a first-time guest with a valid code", async () => {
    bookingCount.mockResolvedValue(0);
    referralCodeFindFirst.mockResolvedValue({
      id: "ref-1",
      code: "FRIENDS10",
      discountPercent: 10,
      expiresAt: null,
      maxUsage: null,
      usageCount: 0,
    });
    const result = await computeBookingTotals({
      stay: baseStay,
      nights: 2,
      guestCount: 1,
      userId: "user-1",
      referralCode: "friends10",
    });
    expect(result.discountPercent).toBe(10);
    expect(result.isLoyaltyDiscount).toBe(false);
    expect(result.validatedReferralCode?.code).toBe("FRIENDS10");
  });

  it("loyalty (20%) wins over a smaller referral discount when both apply", async () => {
    bookingCount.mockResolvedValue(1);
    referralCodeFindFirst.mockResolvedValue({
      id: "ref-1",
      code: "FRIENDS10",
      discountPercent: 10,
      expiresAt: null,
      maxUsage: null,
      usageCount: 0,
    });
    const result = await computeBookingTotals({
      stay: baseStay,
      nights: 2,
      guestCount: 1,
      userId: "user-1",
      referralCode: "FRIENDS10",
    });
    expect(result.discountPercent).toBe(20);
    expect(result.isLoyaltyDiscount).toBe(true);
  });

  it("throws PricingError for an invalid referral code", async () => {
    bookingCount.mockResolvedValue(0);
    referralCodeFindFirst.mockResolvedValue(null);
    await expect(
      computeBookingTotals({
        stay: baseStay,
        nights: 2,
        guestCount: 1,
        userId: "user-1",
        referralCode: "BOGUS",
      })
    ).rejects.toThrow(PricingError);
  });

  it("throws PricingError for zero or negative nights/guestCount", async () => {
    bookingCount.mockResolvedValue(0);
    await expect(
      computeBookingTotals({ stay: baseStay, nights: 0, guestCount: 1, userId: "u" })
    ).rejects.toThrow(PricingError);
    await expect(
      computeBookingTotals({ stay: baseStay, nights: 2, guestCount: 0, userId: "u" })
    ).rejects.toThrow(PricingError);
  });
});
