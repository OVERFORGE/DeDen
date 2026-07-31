// File: lib/inventory.ts
// Stay capacity, counted PER NIGHT.
//
// The original model was a single `Stay.slotsAvailable` counter decremented
// once per booking. That's correct only when every guest books the identical
// window — which stopped being true once stays could allow flexible dates: a
// 3-night guest consumed exactly as much capacity as a 12-night guest, so a
// villa could be simultaneously "sold out" on paper and empty on most nights,
// or oversold on the busy nights in the middle.
//
// Occupancy is now DERIVED from the bookings themselves rather than tracked
// in a counter. That matters because the counter's failure mode was silent
// drift — every code path that created or killed a booking had to remember to
// adjust it, and any miss was invisible until someone was turned away from an
// empty house. Deriving from bookings cannot drift: the bookings *are* the
// truth. `Stay.slotsAvailable` is still maintained, but only as a
// denormalised display value recomputed from that truth.

import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';

/** Statuses that actually occupy a bed. Mirrors when payment has landed. */
const OCCUPYING_STATUSES: BookingStatus[] = [BookingStatus.RESERVED, BookingStatus.CONFIRMED];

const MS_PER_NIGHT = 1000 * 60 * 60 * 24;

/** UTC yyyy-mm-dd key for a date — the unit of capacity. */
export function nightKey(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * The nights a stay from `checkIn` to `checkOut` actually occupies.
 *
 * Half-open [checkIn, checkOut): checking out on the 21st does NOT occupy the
 * night of the 21st, so a guest leaving that morning and one arriving that
 * afternoon can share the same slot rather than double-counting it.
 */
export function nightsInRange(checkIn: Date, checkOut: Date): string[] {
  const nights: string[] = [];
  if (!checkIn || !checkOut) return nights;

  let cursor = Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate());
  const end = Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate());

  // Guard against absurd ranges from bad data rather than looping forever.
  let safety = 0;
  while (cursor < end && safety++ < 1000) {
    nights.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += MS_PER_NIGHT;
  }
  return nights;
}

export interface NightlyOccupancy {
  /** night key -> guests occupying that night */
  byNight: Map<string, number>;
  /** Busiest night's guest count across the whole stay. */
  peak: number;
}

/**
 * Builds the per-night occupancy map for a stay from its live bookings.
 * `excludeBookingId` lets a booking be re-evaluated without counting itself
 * (used when extending an existing booking).
 */
export async function getNightlyOccupancy(
  stayId: string,
  excludeBookingId?: string
): Promise<NightlyOccupancy> {
  const stay = await db.stay.findUnique({
    where: { id: stayId },
    select: { startDate: true, endDate: true },
  });

  const bookings = await db.booking.findMany({
    where: {
      stayId,
      status: { in: OCCUPYING_STATUSES },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
    },
    select: { guestCount: true, checkInDate: true, checkOutDate: true },
  });

  const byNight = new Map<string, number>();

  for (const b of bookings) {
    // Older bookings predate per-booking dates — treat them as occupying the
    // whole stay window, which is what they in fact did.
    const from = b.checkInDate ?? stay?.startDate ?? null;
    const to = b.checkOutDate ?? stay?.endDate ?? null;
    if (!from || !to) continue;

    const guests = b.guestCount || 1;
    for (const night of nightsInRange(new Date(from), new Date(to))) {
      byNight.set(night, (byNight.get(night) || 0) + guests);
    }
  }

  let peak = 0;
  for (const count of byNight.values()) if (count > peak) peak = count;

  return { byNight, peak };
}

export interface RangeAvailability {
  ok: boolean;
  /** First night that can't fit the request, if any. */
  conflictNight?: string;
  /** Free capacity on that night. */
  availableOnConflict?: number;
  /** Smallest free capacity across the requested range. */
  minAvailable: number;
}

/**
 * Can `guestCount` more guests be accommodated on EVERY night of the
 * requested range? A range is only bookable if its tightest night fits.
 */
export async function checkRangeAvailability(
  stayId: string,
  guestCount: number,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
): Promise<RangeAvailability> {
  if (guestCount <= 0) return { ok: true, minAvailable: Number.MAX_SAFE_INTEGER };

  const stay = await db.stay.findUnique({
    where: { id: stayId },
    select: { slotsTotal: true },
  });
  if (!stay) return { ok: false, minAvailable: 0 };

  const capacity = stay.slotsTotal ?? 0;
  const { byNight } = await getNightlyOccupancy(stayId, excludeBookingId);

  const nights = nightsInRange(checkIn, checkOut);
  // A zero-night range occupies nothing, so nothing can block it.
  if (nights.length === 0) return { ok: true, minAvailable: capacity };

  let minAvailable = Number.MAX_SAFE_INTEGER;
  let conflictNight: string | undefined;
  let availableOnConflict: number | undefined;

  for (const night of nights) {
    const free = capacity - (byNight.get(night) || 0);
    if (free < minAvailable) minAvailable = free;
    if (free < guestCount && conflictNight === undefined) {
      conflictNight = night;
      availableOnConflict = Math.max(0, free);
    }
  }

  return {
    ok: conflictNight === undefined,
    conflictNight,
    availableOnConflict,
    minAvailable: Math.max(0, minAvailable),
  };
}

/**
 * Recomputes and persists `Stay.slotsAvailable` from actual bookings.
 *
 * Replaces the old blind increment/decrement pair. Because it derives the
 * value rather than nudging it, it's idempotent and self-healing: calling it
 * twice, or after a booking path forgot to, still lands on the right number.
 *
 * The stored figure is capacity minus the BUSIEST night — the conservative
 * "how many more guests could definitely book the whole window" answer, which
 * is what a stay card showing "N spots left" should mean.
 */
export async function recomputeStayAvailability(stayId: string): Promise<number> {
  const stay = await db.stay.findUnique({
    where: { id: stayId },
    select: { slotsTotal: true },
  });
  if (!stay) return 0;

  const { peak } = await getNightlyOccupancy(stayId);
  const available = Math.max(0, (stay.slotsTotal ?? 0) - peak);

  await db.stay.update({
    where: { id: stayId },
    data: { slotsAvailable: available },
  });

  return available;
}

/**
 * Whole-window availability check. Retained for callers that have no specific
 * date range (e.g. approving a booking whose dates are the stay's own), and
 * now answered from per-night occupancy rather than a counter.
 */
export async function hasAvailableSlots(stayId: string, guestCount: number): Promise<boolean> {
  if (guestCount <= 0) return true;

  const stay = await db.stay.findUnique({
    where: { id: stayId },
    select: { slotsTotal: true, startDate: true, endDate: true },
  });
  if (!stay) return false;

  const result = await checkRangeAvailability(
    stayId,
    guestCount,
    new Date(stay.startDate),
    new Date(stay.endDate)
  );
  return result.ok;
}

/**
 * @deprecated Occupancy is derived from bookings now — there is no counter to
 * hold. Kept as a thin alias so existing call sites stay correct; they simply
 * resync the display value.
 */
export async function holdStaySlots(stayId: string, _guestCount: number): Promise<void> {
  await recomputeStayAvailability(stayId);
}

/**
 * @deprecated See holdStaySlots. Releasing is just a resync now.
 */
export async function releaseStaySlots(stayId: string, _guestCount: number): Promise<void> {
  await recomputeStayAvailability(stayId);
}
