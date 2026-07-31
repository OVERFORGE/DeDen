// File: app/api/user/profile/route.ts
//
// Own-profile read/edit. Previously the only place any of these fields could
// be changed was the apply-for-a-stay form — a typo'd phone number or a
// missing X handle (which the "Who's Coming" feature relies on) could only
// be fixed by re-applying to something.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireUser, authErrorResponse } from '@/lib/api-auth';
import { z } from 'zod';
import { firstValidationMessage } from '@/lib/validate';

export async function GET() {
  try {
    const { userId } = await requireUser();

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        bio: true,
        gender: true,
        age: true,
        mobileNumber: true,
        socialTwitter: true,
        socialTelegram: true,
        socialLinkedin: true,
        socialGithub: true,
        socialWebsite: true,
        walletAddress: true,
        image: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  role: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  gender: z.string().trim().max(30).optional(),
  age: z.number().int().min(13).max(120).optional(),
  mobileNumber: z.string().trim().max(30).optional(),
  socialTwitter: z.string().trim().max(100).optional(),
  socialTelegram: z.string().trim().max(100).optional(),
  socialLinkedin: z.string().trim().max(200).optional(),
  socialGithub: z.string().trim().max(100).optional(),
  socialWebsite: z.string().trim().max(200).optional(),
});

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireUser();

    const body = await request.json().catch(() => ({}));
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationMessage(parsed.error, 'Invalid profile data') },
        { status: 400 }
      );
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: parsed.data,
      select: {
        displayName: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        bio: true,
        gender: true,
        age: true,
        mobileNumber: true,
        socialTwitter: true,
        socialTelegram: true,
        socialLinkedin: true,
        socialGithub: true,
        socialWebsite: true,
        walletAddress: true,
        image: true,
      },
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
