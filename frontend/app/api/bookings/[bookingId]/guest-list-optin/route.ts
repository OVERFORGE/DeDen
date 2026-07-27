// File: app/api/bookings/[bookingId]/guest-list-optin/route.ts
//
// PATCH — lets a guest choose whether they appear in their stay's guest
// list. Opt-in is off by default: appearing in a roster visible to other
// attendees is something the guest should actively choose, not something
// that happens to them silently.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireBookingOwner, authErrorResponse } from '@/lib/api-auth';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await context.params;
    const { booking, userId } = await requireBookingOwner(bookingId);

    const body = await request.json().catch(() => ({}));
    const optIn = body?.optIn;

    if (typeof optIn !== 'boolean') {
      return NextResponse.json(
        { error: 'optIn must be true or false' },
        { status: 400 }
      );
    }

    const updated = await db.booking.update({
      where: { id: booking.id },
      data: { optInGuestList: optIn },
      select: { optInGuestList: true },
    });

    await db.activityLog.create({
      data: {
        userId,
        bookingId: booking.id,
        action: optIn ? 'guest_list_opt_in' : 'guest_list_opt_out',
        entity: 'booking',
        entityId: booking.id,
        details: { optInGuestList: optIn },
      },
    });

    return NextResponse.json({ success: true, optInGuestList: updated.optInGuestList });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error updating guest list opt-in:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
