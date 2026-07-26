// File: app/api/tickets/[ticketCode]/check-in/route.ts
// POST /api/tickets/[ticketCode]/check-in — admin/staff only. Idempotent:
// rejects a second check-in instead of silently re-stamping it.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';
import { checkInTicket } from '@/lib/ticket-service';

export async function POST(
  request: Request,
  context: { params: Promise<{ ticketCode: string }> }
) {
  try {
    const { userId } = await requireAdmin();
    const { ticketCode } = await context.params;

    const result = await checkInTicket(ticketCode, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    await db.activityLog.create({
      data: {
        userId,
        action: 'ticket_checked_in',
        entity: 'ticket',
        entityId: result.ticket!.id,
        details: {
          ticketCode,
          bookingId: result.ticket!.bookingId,
          checkedInBy: userId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      ticket: {
        ticketCode: result.ticket!.ticketCode,
        status: result.ticket!.status,
        checkedInAt: result.ticket!.checkedInAt,
      },
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error checking in ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
