// Per-night inventory. The core property under test: capacity is checked
// against the BUSIEST overlapping night, not a single whole-stay counter —
// that's the whole reason this module exists (see lib/inventory.ts header).

import { describe, it, expect, vi, beforeEach } from "vitest";

const stayFindUnique = vi.fn();
const stayUpdate = vi.fn();
const bookingFindMany = vi.fn();

vi.mock("@/lib/database", () => ({
  db: {
    stay: {
      findUnique: (...args: any[]) => stayFindUnique(...args),
      update: (...args: any[]) => stayUpdate(...args),
    },
    booking: {
      findMany: (...args: any[]) => bookingFindMany(...args),
    },
  },
}));

const {
  nightsInRange,
  getNightlyOccupancy,
  checkRangeAvailability,
  recomputeStayAvailability,
  hasAvailableSlots,
} = await import("@/lib/inventory");

beforeEach(() => {
  stayFindUnique.mockReset();
  stayUpdate.mockReset();
  bookingFindMany.mockReset();
});

function booking(guestCount: number, checkIn: string, checkOut: string) {
  return { guestCount, checkInDate: new Date(checkIn), checkOutDate: new Date(checkOut) };
}

describe("nightsInRange", () => {
  it("is half-open: check-out night itself is not occupied", () => {
    // A 3-night stay Mon->Thu occupies Mon, Tue, Wed — not Thu.
    expect(nightsInRange(new Date("2026-10-14"), new Date("2026-10-17"))).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
  });

  it("same-day range occupies nothing", () => {
    expect(nightsInRange(new Date("2026-10-14"), new Date("2026-10-14"))).toEqual([]);
  });

  it("single night", () => {
    expect(nightsInRange(new Date("2026-10-14"), new Date("2026-10-15"))).toEqual(["2026-10-14"]);
  });
});

describe("getNightlyOccupancy", () => {
  it("sums guests per night across overlapping bookings", async () => {
    stayFindUnique.mockResolvedValue({ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31") });
    bookingFindMany.mockResolvedValue([
      booking(2, "2026-10-14", "2026-10-17"), // 14,15,16
      booking(3, "2026-10-16", "2026-10-19"), // 16,17,18 -- overlaps on the 16th
    ]);
    const { byNight, peak } = await getNightlyOccupancy("stay-1");
    expect(byNight.get("2026-10-14")).toBe(2);
    expect(byNight.get("2026-10-16")).toBe(5); // both bookings overlap here
    expect(byNight.get("2026-10-18")).toBe(3);
    expect(peak).toBe(5);
  });

  it("adjacent (non-overlapping) bookings don't double-count the boundary night", async () => {
    stayFindUnique.mockResolvedValue({ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31") });
    bookingFindMany.mockResolvedValue([
      booking(4, "2026-10-14", "2026-10-18"), // checks out the 18th
      booking(4, "2026-10-18", "2026-10-22"), // checks in the 18th — should NOT overlap
    ]);
    const { byNight, peak } = await getNightlyOccupancy("stay-1");
    expect(byNight.get("2026-10-17")).toBe(4);
    expect(byNight.get("2026-10-18")).toBe(4); // only the second booking's first night
    expect(peak).toBe(4);
  });

  it("legacy bookings with no per-booking dates fall back to the whole stay window", async () => {
    stayFindUnique.mockResolvedValue({ startDate: new Date("2026-10-14"), endDate: new Date("2026-10-16") });
    bookingFindMany.mockResolvedValue([{ guestCount: 2, checkInDate: null, checkOutDate: null }]);
    const { byNight } = await getNightlyOccupancy("stay-1");
    expect(byNight.get("2026-10-14")).toBe(2);
    expect(byNight.get("2026-10-15")).toBe(2);
    expect(byNight.has("2026-10-16")).toBe(false); // half-open
  });

  it("excludeBookingId omits that booking's own dates from the query", async () => {
    stayFindUnique.mockResolvedValue({ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31") });
    bookingFindMany.mockResolvedValue([]);
    await getNightlyOccupancy("stay-1", "BOOKING-42");
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bookingId: { not: "BOOKING-42" } }),
      })
    );
  });
});

describe("checkRangeAvailability", () => {
  it("ok when every night in range has room", async () => {
    stayFindUnique.mockResolvedValue({ slotsTotal: 10 });
    bookingFindMany.mockResolvedValue([booking(3, "2026-10-14", "2026-10-17")]);
    const result = await checkRangeAvailability("stay-1", 5, new Date("2026-10-14"), new Date("2026-10-17"));
    expect(result.ok).toBe(true);
    expect(result.minAvailable).toBe(7); // 10 - 3
  });

  it("rejects when the TIGHTEST night in range can't fit — even if other nights are free", async () => {
    stayFindUnique.mockResolvedValue({ slotsTotal: 10 });
    // Only the 16th is nearly full; 14th and 15th have room.
    bookingFindMany.mockResolvedValue([booking(8, "2026-10-16", "2026-10-17")]);
    const result = await checkRangeAvailability("stay-1", 5, new Date("2026-10-14"), new Date("2026-10-17"));
    expect(result.ok).toBe(false);
    expect(result.conflictNight).toBe("2026-10-16");
    expect(result.availableOnConflict).toBe(2); // 10 - 8
  });

  it("a short booking can fit in a gap that a longer one couldn't", async () => {
    stayFindUnique.mockResolvedValue({ slotsTotal: 10 });
    bookingFindMany.mockResolvedValue([booking(8, "2026-10-16", "2026-10-17")]);
    // Same scenario, but only requesting the 14th-15th, avoiding the busy night.
    const result = await checkRangeAvailability("stay-1", 5, new Date("2026-10-14"), new Date("2026-10-16"));
    expect(result.ok).toBe(true);
  });

  it("zero-guest request always ok without hitting the DB", async () => {
    const result = await checkRangeAvailability("stay-1", 0, new Date("2026-10-14"), new Date("2026-10-17"));
    expect(result.ok).toBe(true);
    expect(stayFindUnique).not.toHaveBeenCalled();
  });

  it("missing stay is not available", async () => {
    stayFindUnique.mockResolvedValue(null);
    const result = await checkRangeAvailability("missing", 1, new Date("2026-10-14"), new Date("2026-10-17"));
    expect(result.ok).toBe(false);
  });

  it("excludeBookingId lets a booking extend its own range without self-blocking", async () => {
    stayFindUnique.mockResolvedValue({ slotsTotal: 10 });
    // If this booking's own 8 guests were counted, it would block itself.
    bookingFindMany.mockResolvedValue([]); // simulates the mock already excluding it
    const result = await checkRangeAvailability(
      "stay-1",
      2,
      new Date("2026-10-16"),
      new Date("2026-10-17"),
      "MY-BOOKING"
    );
    expect(result.ok).toBe(true);
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ bookingId: { not: "MY-BOOKING" } }) })
    );
  });
});

describe("recomputeStayAvailability", () => {
  it("persists capacity minus the peak night", async () => {
    stayFindUnique.mockResolvedValueOnce({ slotsTotal: 20 }).mockResolvedValueOnce({
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-31"),
    });
    bookingFindMany.mockResolvedValue([
      booking(5, "2026-10-14", "2026-10-17"),
      booking(3, "2026-10-16", "2026-10-19"),
    ]);
    const available = await recomputeStayAvailability("stay-1");
    // peak night (the 16th) has 5+3=8 guests -> 20-8=12
    expect(available).toBe(12);
    expect(stayUpdate).toHaveBeenCalledWith({ where: { id: "stay-1" }, data: { slotsAvailable: 12 } });
  });

  it("clamps at 0 when overbooked (shouldn't happen, but must not go negative)", async () => {
    stayFindUnique.mockResolvedValueOnce({ slotsTotal: 5 }).mockResolvedValueOnce({
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-31"),
    });
    bookingFindMany.mockResolvedValue([booking(9, "2026-10-14", "2026-10-15")]);
    const available = await recomputeStayAvailability("stay-1");
    expect(available).toBe(0);
  });

  it("is idempotent: calling twice yields the same persisted value", async () => {
    const stayData = { slotsTotal: 10 };
    const windowData = { startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31") };
    stayFindUnique.mockImplementation(({ select }: any) =>
      Promise.resolve(select?.slotsTotal !== undefined ? stayData : windowData)
    );
    bookingFindMany.mockResolvedValue([booking(4, "2026-10-14", "2026-10-16")]);
    const first = await recomputeStayAvailability("stay-1");
    const second = await recomputeStayAvailability("stay-1");
    expect(first).toBe(second);
  });

  it("returns 0 for a missing stay without writing", async () => {
    stayFindUnique.mockResolvedValue(null);
    const available = await recomputeStayAvailability("missing");
    expect(available).toBe(0);
    expect(stayUpdate).not.toHaveBeenCalled();
  });
});

describe("hasAvailableSlots", () => {
  it("checks the whole stay window for the guest count", async () => {
    stayFindUnique.mockImplementation(({ select }: any) =>
      Promise.resolve(
        select?.slotsTotal !== undefined && select?.startDate !== undefined
          ? { slotsTotal: 10, startDate: new Date("2026-10-14"), endDate: new Date("2026-10-26") }
          : { slotsTotal: 10 }
      )
    );
    bookingFindMany.mockResolvedValue([]);
    expect(await hasAvailableSlots("stay-1", 5)).toBe(true);
  });

  it("false when the stay doesn't exist", async () => {
    stayFindUnique.mockResolvedValue(null);
    expect(await hasAvailableSlots("missing", 1)).toBe(false);
  });

  it("true (no-op) for zero guests", async () => {
    expect(await hasAvailableSlots("stay-1", 0)).toBe(true);
    expect(stayFindUnique).not.toHaveBeenCalled();
  });
});
