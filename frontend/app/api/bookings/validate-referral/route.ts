// File: app/api/bookings/validate-referral/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma'; // Adjust path to your Prisma client

/**
 * POST /api/bookings/validate-referral
 * Validate a referral code before application submission
 *
 * ✅ UPDATED: Now accepts 'publicStayId' (e.g., TSTE-2025)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // ✅ Changed 'stayId' to 'publicStayId' to be explicit
    const { code, publicStayId } = body;

    // Validation
    if (!code || !publicStayId) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Code and publicStayId are required', // ✅ Updated error
        },
        { status: 400 }
      );
    }

    // ✅ Step 1: Find the stay using the public ID
    const stay = await prisma.stay.findUnique({
      where: { stayId: publicStayId },
      select: { id: true, title: true, stayId: true },
    });

    if (!stay) {
      return NextResponse.json({
        valid: false,
        error: 'Stay not found',
      });
    }

    // ✅ Step 2: Find the referral code by its code string
    const referralCode = await prisma.referralCode.findUnique({
      where: {
        code: code.toUpperCase().trim(),
      },
    });

    // Check if code exists
    if (!referralCode) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid referral code',
      });
    }

    // Check if code is active
    if (!referralCode.isActive) {
      return NextResponse.json({
        valid: false,
        error: 'This referral code is no longer active',
      });
    }

    // ✅ Step 3: Compare the referral code's stay ID (db id) with the found stay's db id
    if (referralCode.stayId !== stay.id) {
      return NextResponse.json({
        valid: false,
        error: 'This referral code is not valid for this stay',
      });
    }

    // Check expiration
    if (referralCode.expiresAt && new Date(referralCode.expiresAt) < new Date()) {
      return NextResponse.json({
        valid: false,
        error: 'This referral code has expired',
      });
    }

    // Check usage limit
    if (
      referralCode.maxUsage !== null &&
      referralCode.usageCount >= referralCode.maxUsage
    ) {
      return NextResponse.json({
        valid: false,
        error: 'This referral code has reached its usage limit',
      });
    }

    // Code is valid!
    return NextResponse.json({
      valid: true,
      message: `${referralCode.discountPercent}% discount from ${referralCode.communityName} applied!`,
      referralCode: {
        id: referralCode.id,
        code: referralCode.code,
        communityName: referralCode.communityName,
        discountPercent: referralCode.discountPercent,
        stayTitle: stay.title,
      },
    });
  } catch (error) {
    console.error('[Validate Referral] Error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: 'Failed to validate referral code',
      },
      { status: 500 }
    );
  }
}