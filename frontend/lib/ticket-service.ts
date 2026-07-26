// File: lib/ticket-service.ts
// Real, server-backed tickets — one per guest on a booking, with a
// tamper-evident QR token that can be verified without a database round
// trip. This replaces "the NFT is the ticket" (one per booking regardless
// of guest count, QR just links to the payment page, no way to check
// someone in at the door).

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import QRCode from 'qrcode';
import { db } from '@/lib/database';
import { TicketStatus } from '@prisma/client';

function getQrSecret(): string {
  const secret = process.env.TICKET_QR_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('TICKET_QR_SECRET (or NEXTAUTH_SECRET as fallback) must be set');
  }
  return secret;
}

/**
 * Signs a ticket code into an opaque, verifiable token. Format:
 * base64url(ticketCode).base64url(hmac) — no DB lookup needed to detect
 * tampering; a DB lookup is still done at verify/check-in time to fetch the
 * actual ticket state (ISSUED/CHECKED_IN/VOID).
 */
export function signQrToken(ticketCode: string): string {
  const secret = getQrSecret();
  const nonce = randomBytes(6).toString('base64url');
  const payload = `${ticketCode}.${nonce}`;
  const hmac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${hmac}`;
}

export interface VerifiedQrToken {
  valid: boolean;
  ticketCode?: string;
  reason?: string;
}

export function verifyQrToken(qrToken: string): VerifiedQrToken {
  try {
    const [payloadB64, hmac] = qrToken.split('.');
    if (!payloadB64 || !hmac) {
      return { valid: false, reason: 'Malformed token' };
    }

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const [ticketCode] = payload.split('.');
    if (!ticketCode) {
      return { valid: false, reason: 'Malformed token' };
    }

    const secret = getQrSecret();
    const expectedHmac = createHmac('sha256', secret).update(payload).digest('base64url');

    const a = Buffer.from(hmac);
    const b = Buffer.from(expectedHmac);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    return { valid: true, ticketCode };
  } catch {
    return { valid: false, reason: 'Malformed token' };
  }
}

/**
 * Issues one Ticket per guest on a booking. Idempotent — safe to call
 * multiple times (e.g. if verification retries); existing tickets for the
 * booking are returned as-is rather than duplicated.
 */
export async function issueTicketsForBooking(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { bookingId },
    include: { stay: true },
  });

  if (!booking) {
    throw new Error(`Cannot issue tickets — booking ${bookingId} not found`);
  }

  const existing = await db.ticket.findMany({ where: { bookingId: booking.id } });
  if (existing.length > 0) {
    console.log(`[Tickets] ${existing.length} ticket(s) already issued for booking ${bookingId}, skipping`);
    return existing;
  }

  const guests = (booking.guests as any[]) || [];
  // Fall back to a single ticket from the primary guest snapshot if the
  // guests[] array is empty (older bookings created before multi-guest
  // persistence landed).
  const guestList = guests.length > 0
    ? guests
    : [{ fullName: booking.guestName, email: booking.guestEmail }];

  const tickets = [];
  for (let i = 0; i < guestList.length; i++) {
    const guest = guestList[i];
    const ticketCode = `TKT-${booking.stay.stayId}-${booking.bookingId.split('-').pop()}-${i + 1}`;
    const qrToken = signQrToken(ticketCode);

    const ticket = await db.ticket.create({
      data: {
        ticketCode,
        bookingId: booking.id,
        stayId: booking.stayId,
        userId: booking.userId,
        guestIndex: i,
        guestName: guest?.fullName || null,
        guestEmail: guest?.email || null,
        qrToken,
        status: TicketStatus.ISSUED,
      },
    });

    tickets.push(ticket);
  }

  console.log(`[Tickets] Issued ${tickets.length} ticket(s) for booking ${bookingId}`);
  return tickets;
}

/**
 * Renders a ticket's QR code as a data URL PNG, encoding the signed token
 * (not a payment URL — this is a verifiable credential, not a link).
 */
export async function renderTicketQr(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, {
    color: { dark: '#3D4331', light: '#F3EDE0' },
    width: 240,
    margin: 2,
    errorCorrectionLevel: 'H',
  });
}

/**
 * Fetches a booking's tickets with rendered QR codes, in the shape
 * sendConfirmationEmail expects. Call after issueTicketsForBooking.
 */
export async function getTicketEmailPayload(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { bookingId } });
  if (!booking) return [];

  const tickets = await db.ticket.findMany({
    where: { bookingId: booking.id },
    orderBy: { guestIndex: 'asc' },
  });

  return Promise.all(
    tickets.map(async (t) => ({
      ticketCode: t.ticketCode,
      guestName: t.guestName || 'Guest',
      qrDataUrl: await renderTicketQr(t.qrToken),
    }))
  );
}

export interface CheckInResult {
  success: boolean;
  error?: string;
  ticket?: Awaited<ReturnType<typeof db.ticket.findUnique>>;
}

/**
 * Marks a ticket as checked in. Idempotent-safe: rejects a second check-in
 * rather than silently re-stamping the timestamp.
 */
export async function checkInTicket(ticketCode: string, checkedInBy: string): Promise<CheckInResult> {
  const ticket = await db.ticket.findUnique({ where: { ticketCode } });

  if (!ticket) {
    return { success: false, error: 'Ticket not found' };
  }
  if (ticket.status === TicketStatus.VOID) {
    return { success: false, error: 'This ticket has been voided' };
  }
  if (ticket.status === TicketStatus.CHECKED_IN) {
    return { success: false, error: `Already checked in at ${ticket.checkedInAt?.toISOString()}` };
  }

  const updated = await db.ticket.update({
    where: { ticketCode },
    data: {
      status: TicketStatus.CHECKED_IN,
      checkedInAt: new Date(),
      checkedInBy,
    },
  });

  return { success: true, ticket: updated };
}
