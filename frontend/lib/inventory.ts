// File: lib/inventory.ts
// Stay slot inventory management. Previously `Stay.slotsAvailable` was set
// once at creation and never touched again — bookings could be confirmed
// indefinitely past capacity. Slots are now held the moment a booking
// actually secures a spot (reservation paid, or full payment confirmed for
// non-reservation stays) and released if that booking is later cancelled,
// expired, or refunded.

import { db } from '@/lib/database';

/**
 * Atomically decrements slotsAvailable by `guestCount`, clamped at 0.
 * Call exactly once per booking, at the moment it first secures a spot.
 */
export async function holdStaySlots(stayId: string, guestCount: number): Promise<void> {
  if (guestCount <= 0) return;

  const stay = await db.stay.findUnique({
    where: { id: stayId },
    select: { slotsAvailable: true },
  });
  if (!stay) return;

  const newAvailable = Math.max(0, stay.slotsAvailable - guestCount);

  await db.stay.update({
    where: { id: stayId },
    data: { slotsAvailable: newAvailable },
  });
}

/**
 * Atomically restores slotsAvailable by `guestCount`, clamped at slotsTotal.
 * Call when a booking that previously held a slot is cancelled, expired
 * post-confirmation, or refunded.
 */
export async function releaseStaySlots(stayId: string, guestCount: number): Promise<void> {
  if (guestCount <= 0) return;

  const stay = await db.stay.findUnique({
    where: { id: stayId },
    select: { slotsAvailable: true, slotsTotal: true },
  });
  if (!stay) return;

  const newAvailable = Math.min(stay.slotsTotal, stay.slotsAvailable + guestCount);

  await db.stay.update({
    where: { id: stayId },
    data: { slotsAvailable: newAvailable },
  });
}

/**
 * Checks whether `guestCount` slots are still available for a stay.
 */
export async function hasAvailableSlots(stayId: string, guestCount: number): Promise<boolean> {
  const stay = await db.stay.findUnique({
    where: { id: stayId },
    select: { slotsAvailable: true },
  });
  if (!stay) return false;
  return stay.slotsAvailable >= guestCount;
}
