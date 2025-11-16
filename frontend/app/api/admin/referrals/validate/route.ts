// File: app/api/referrals/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/referrals/validate?code=XXX&stayId=YYY
 * Validate a referral code for a specific stay
 * 
 * This is called by the apply form to check if a referral code is valid
 * before the user submits their application
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stayId = searchParams.get('stayId');

    // Validation
    if (!code || !stayId) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Code and stayId are required' 
        },
        { status: 400 }
      );
    }

    // Find the referral code
    const referralCode = await prisma.referralCode.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        stayId: stayId,
        isActive: true,
      },
      include: {
        stay: {
          select: {
            title: true,
            stayId: true,
          },
        },
      },
    });

    if (!referralCode) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid referral code for this stay' 
        },
        { status: 404 }
      );
    }

    // Check if expired
    if (referralCode.expiresAt && new Date(referralCode.expiresAt) < new Date()) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'This referral code has expired' 
        },
        { status: 410 }
      );
    }

    // Check usage limit
    if (referralCode.maxUsage && referralCode.usageCount >= referralCode.maxUsage) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'This referral code has reached its usage limit' 
        },
        { status: 410 }
      );
    }

    // Valid code!
    return NextResponse.json({
      valid: true,
      code: referralCode.code,
      communityName: referralCode.communityName,
      discountPercent: referralCode.discountPercent,
      usageCount: referralCode.usageCount,
      maxUsage: referralCode.maxUsage,
      stay: {
        title: referralCode.stay.title,
        stayId: referralCode.stay.stayId,
      },
    });

  } catch (error) {
    console.error('[Validate Referral] Error:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Failed to validate referral code' 
      },
      { status: 500 }
    );
  }
}