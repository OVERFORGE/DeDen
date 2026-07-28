// File: lib/ticket-service.ts
// Real, server-backed tickets — one per guest on a booking, with a
// tamper-evident QR token that can be verified without a database round
// trip. This replaces "the NFT is the ticket" (one per booking regardless
// of guest count, QR just links to the payment page, no way to check
// someone in at the door).

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
 * Issues one Ticket per guest on a booking. Idempotent AND additive: guest
 * indices that already have a ticket are left alone, and only newly added
 * guests (e.g. from extending an already-CONFIRMED booking with more
 * guests, whose top-up payment just confirmed) get a new ticket.
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
  const alreadyTicketedIndices = new Set(existing.map((t) => t.guestIndex));

  const guests = (booking.guests as any[]) || [];
  // Fall back to a single ticket from the primary guest snapshot if the
  // guests[] array is empty (older bookings created before multi-guest
  // persistence landed).
  const guestList = guests.length > 0
    ? guests
    : [{ fullName: booking.guestName, email: booking.guestEmail }];

  if (existing.length > 0 && guestList.every((_, i) => alreadyTicketedIndices.has(i))) {
    console.log(`[Tickets] All ${existing.length} guest(s) already ticketed for booking ${bookingId}, skipping`);
    return existing;
  }

  const tickets = [...existing];
  for (let i = 0; i < guestList.length; i++) {
    if (alreadyTicketedIndices.has(i)) continue;

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

interface TicketPdfParams {
  ticketCode: string;
  guestName: string;
  qrToken: string;
  stayTitle: string;
  stayLocation: string;
  checkInDate: Date;
  checkOutDate: Date;
}

/**
 * Renders a single ticket as a standalone PDF (voucher-style: header, event
 * details, QR, guest/ticket code) — sent as an email attachment rather than
 * embedded inline, since inline QR images render inconsistently across mail
 * clients and get stripped by some image-blocking defaults.
 */
export async function renderTicketPdf(params: TicketPdfParams): Promise<Buffer> {
  const { ticketCode, guestName, qrToken, stayTitle, stayLocation, checkInDate, checkOutDate } = params;

  const qrPngBuffer = await QRCode.toBuffer(qrToken, {
    color: { dark: '#1F2328', light: '#FFFFFF' },
    width: 400,
    margin: 1,
    errorCorrectionLevel: 'H',
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([360, 560]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textDark = rgb(0.12, 0.14, 0.16);
  const textMuted = rgb(0.42, 0.44, 0.47);
  const accent = rgb(0.24, 0.26, 0.19); // #3D4331
  const border = rgb(0.89, 0.9, 0.92);

  let y = 560;

  // Header bar
  page.drawRectangle({ x: 0, y: y - 56, width: 360, height: 56, color: accent });
  page.drawText('DeDen', { x: 24, y: y - 36, size: 18, font: bold, color: rgb(1, 1, 1) });
  y -= 56;

  // Event title + location + dates
  y -= 32;
  page.drawText(stayTitle, { x: 24, y, size: 15, font: bold, color: textDark, maxWidth: 312 });
  y -= 20;
  page.drawText(stayLocation, { x: 24, y, size: 11, font, color: textMuted });
  y -= 16;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  page.drawText(`${fmt(checkInDate)} - ${fmt(checkOutDate)}`, { x: 24, y, size: 11, font, color: textMuted });

  // Divider
  y -= 24;
  page.drawLine({ start: { x: 24, y }, end: { x: 336, y }, thickness: 1, color: border });

  // QR block, centered
  const qrImage = await pdfDoc.embedPng(qrPngBuffer);
  const qrSize = 200;
  const qrX = (360 - qrSize) / 2;
  y -= 24 + qrSize;
  page.drawRectangle({ x: qrX - 16, y: y - 16, width: qrSize + 32, height: qrSize + 32, borderColor: border, borderWidth: 1, color: rgb(1, 1, 1) });
  page.drawImage(qrImage, { x: qrX, y, width: qrSize, height: qrSize });

  // Guest name + ticket code, centered
  y -= 36;
  const guestLine = guestName || 'Guest';
  const guestWidth = bold.widthOfTextAtSize(guestLine, 14);
  page.drawText(guestLine, { x: (360 - guestWidth) / 2, y, size: 14, font: bold, color: textDark });
  y -= 18;
  const codeWidth = font.widthOfTextAtSize(ticketCode, 10);
  page.drawText(ticketCode, { x: (360 - codeWidth) / 2, y, size: 10, font, color: textMuted });

  // Footer note
  y -= 40;
  const note = 'Present this QR code at check-in. Each guest has their own ticket.';
  const noteWidth = font.widthOfTextAtSize(note, 9);
  page.drawText(note, { x: Math.max(24, (360 - noteWidth) / 2), y, size: 9, font, color: textMuted });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/**
 * Fetches a booking's tickets with rendered PDF attachments, in the shape
 * sendConfirmationEmail expects. Call after issueTicketsForBooking.
 */
export async function getTicketEmailPayload(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { bookingId }, include: { stay: true } });
  if (!booking) return [];

  const tickets = await db.ticket.findMany({
    where: { bookingId: booking.id },
    orderBy: { guestIndex: 'asc' },
  });

  return Promise.all(
    tickets.map(async (t) => {
      const pdfBuffer = await renderTicketPdf({
        ticketCode: t.ticketCode,
        guestName: t.guestName || 'Guest',
        qrToken: t.qrToken,
        stayTitle: booking.stay.title,
        stayLocation: booking.stay.location,
        checkInDate: booking.checkInDate || booking.stay.startDate,
        checkOutDate: booking.checkOutDate || booking.stay.endDate,
      });
      return {
        ticketCode: t.ticketCode,
        guestName: t.guestName || 'Guest',
        pdfBase64: pdfBuffer.toString('base64'),
      };
    })
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
