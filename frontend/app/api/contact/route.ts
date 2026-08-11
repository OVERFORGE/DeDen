// File: app/api/contact/route.ts
// POST — public. Validates and stores a contact-form submission (Notification
// row) and emails the team. Previously the contact form's onSubmit just did
// a setTimeout and discarded the message — nothing was ever sent anywhere.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { sendContactNotification } from '@/lib/email';
import { isRateLimited, getRequestIp } from '@/lib/rate-limit';
import { z } from 'zod';
import { firstValidationMessage } from '@/lib/validate';

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(2000),
});

// 5 submissions per IP per 10 minutes — casual abuse/spam-bot deterrent.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    if (isRateLimited(`contact:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ error: 'Too many messages sent. Please try again later.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationMessage(parsed.error, 'Invalid submission') },
        { status: 400 }
      );
    }

    const { name, email, message } = parsed.data;

    await db.notification.create({
      data: {
        recipientEmail: 'bookings@deden.space',
        type: 'contact_submission',
        subject: `New contact form message from ${name}`,
        body: message,
        status: 'pending',
        metadata: { name, email, ip },
      },
    });

    const emailSent = await sendContactNotification({ name, email, message });

    return NextResponse.json({ success: true, emailSent });
  } catch (error) {
    console.error('[API] Error handling contact submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
