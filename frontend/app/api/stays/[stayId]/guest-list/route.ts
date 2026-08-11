// File: app/api/stays/[stayId]/guest-list/route.ts
//
// "Who's coming" roster for a stay. Three gates, all required:
//   1. The stay must have guestListEnabled turned on by an admin.
//   2. The requester must themselves be an accepted guest of that stay
//      (CONFIRMED or RESERVED) — this is not public information.
//   3. Only guests who opted in via optInGuestList appear in the results.
//
// Returns display name + X handle only. Never email, phone, or wallet.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { requireUser, authErrorResponse } from '@/lib/api-auth';

// A booking counts as "accepted" once the guest has paid something and
// holds a slot.
const ACCEPTED: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.RESERVED];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stayId: string }> }
) {
  try {
    const { userId } = await requireUser();
    const { stayId } = await params;

    if (!stayId) {
      return NextResponse.json({ error: 'Stay ID not provided' }, { status: 400 });
    }

    const stay = await db.stay.findUnique({
      where: { stayId },
      select: { id: true, title: true, guestListEnabled: true },
    });

    if (!stay) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }

    if (!stay.guestListEnabled) {
      return NextResponse.json(
        { error: 'The guest list is not enabled for this stay', enabled: false },
        { status: 403 }
      );
    }

    // Gate 2 — requester must be an accepted guest of this stay.
    const ownBooking = await db.booking.findFirst({
      where: {
        stayId: stay.id,
        userId,
        status: { in: ACCEPTED },
      },
      select: { id: true, optInGuestList: true },
    });

    if (!ownBooking) {
      return NextResponse.json(
        { error: 'Only confirmed guests of this stay can view the guest list' },
        { status: 403 }
      );
    }

    const bookings = await db.booking.findMany({
      where: {
        stayId: stay.id,
        status: { in: ACCEPTED },
        optInGuestList: true,
      },
      select: {
        userId: true,
        guestName: true,
        guestCount: true,
        guests: true,
        confirmedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch user profiles separately so an orphaned userId can't blow up the
    // whole request (same pattern as the admin bookings route).
    const userIds = [...new Set(bookings.map((b) => b.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, role: true, socialTwitter: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const guestList = bookings.flatMap((booking) => {
      const profile = userMap.get(booking.userId);

      // Primary guest, from their account profile.
      const entries = [
        {
          name: profile?.displayName || booking.guestName || 'Guest',
          role: profile?.role || null,
          xHandle: normalizeXHandle(profile?.socialTwitter),
          isPrimary: true,
        },
      ];

      // Additional guests on the same booking.
      //
      // PRIVACY: `optInGuestList` is a per-BOOKING flag set by whoever filled
      // in the application — it is not consent from the other people on that
      // booking. Publishing a secondary guest's X handle (a directly
      // identifying, contactable handle) on the strength of someone else's
      // click isn't consent we actually have. So they're listed by first name
      // only, with no social handle, purely so the roster count and "who's
      // here" reads correctly.
      const extra = ((booking.guests as any[]) || []).slice(1);
      for (const g of extra) {
        if (!g?.fullName) continue;
        entries.push({
          name: String(g.fullName).trim().split(/\s+/)[0],
          role: null,
          xHandle: null,
          isPrimary: false,
        });
      }

      return entries;
    });

    return NextResponse.json({
      enabled: true,
      stayTitle: stay.title,
      youAreListed: ownBooking.optInGuestList,
      total: guestList.length,
      guests: guestList,
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching guest list:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Accepts "@name", "name", or a full x.com/twitter.com URL and returns a bare
 * handle without the leading @, so the UI can link consistently.
 */
function normalizeXHandle(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/(?:twitter\.com|x\.com)\/@?([A-Za-z0-9_]{1,15})/i);
  if (urlMatch) return urlMatch[1];

  return trimmed.replace(/^@/, '').replace(/\s+/g, '') || null;
}
