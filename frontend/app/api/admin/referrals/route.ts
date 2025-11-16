// File: app/api/admin/referrals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Generate a random referral code
 * Format: COMMUNITY-STAY-XXXXX
 */
function generateReferralCode(communityName: string, stayId: string): string {
  const communityPrefix = communityName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3);
  
  const stayPrefix = stayId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3);
  
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  
  return `${communityPrefix}-${stayPrefix}-${random}`;
}

/**
 * GET /api/admin/referrals
 * Fetch all referral codes with statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Add admin role check
    // if (session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    // Fetch all referral codes with related data
    const referralCodes = await prisma.referralCode.findMany({
      include: {
        stay: {
          select: {
            id: true,
            stayId: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        },
        bookings: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate statistics for each code
    const codesWithStats = referralCodes.map((code) => {
      const confirmedBookings = code.bookings.filter(
        (b) => b.status === 'CONFIRMED'
      ).length;
      
      // ✅ Fixed: Use correct BookingStatus enum values
      const pendingBookings = code.bookings.filter(
        (b) => b.status === 'PENDING' || b.status === 'WAITLISTED'
      ).length;

      const totalRevenue = code.bookings
        .filter((b) => b.status === 'CONFIRMED')
        .reduce((sum, b) => sum + (b.finalPrice || 0), 0);

      const totalDiscount = code.bookings
        .filter((b) => b.status === 'CONFIRMED')
        .reduce((sum, b) => sum + ((b.originalPrice || 0) - (b.finalPrice || 0)), 0);

      return {
        ...code,
        stats: {
          totalUsage: code.usageCount,
          confirmedBookings,
          pendingBookings,
          totalRevenue,
          totalDiscount,
        },
      };
    });

    return NextResponse.json(codesWithStats);
  } catch (error) {
    console.error('[Admin Referrals GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral codes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/referrals
 * Create new referral codes for a community
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Add admin role check
    // if (session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const body = await request.json();
    const {
      communityName,
      stayId,
      numberOfCodes = 1,
      discountPercent = 10,
      maxUsage = null,
      expiresAt = null,
      notes = null,
    } = body;

    // Validation
    if (!communityName || !stayId) {
      return NextResponse.json(
        { error: 'Community name and stay ID are required' },
        { status: 400 }
      );
    }

    if (numberOfCodes < 1 || numberOfCodes > 20) {
      return NextResponse.json(
        { error: 'Number of codes must be between 1 and 20' },
        { status: 400 }
      );
    }

    if (discountPercent < 1 || discountPercent > 100) {
      return NextResponse.json(
        { error: 'Discount percent must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Verify stay exists
    const stay = await prisma.stay.findUnique({
      where: { id: stayId },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    // Generate multiple unique codes
    const codes: string[] = [];
    const existingCodes = new Set(
      (await prisma.referralCode.findMany({
        select: { code: true },
      })).map((c) => c.code)
    );

    while (codes.length < numberOfCodes) {
      const newCode = generateReferralCode(communityName, stay.stayId);
      
      // Ensure uniqueness
      if (!existingCodes.has(newCode) && !codes.includes(newCode)) {
        codes.push(newCode);
      }
    }

    // Create referral codes in database
    const createdCodes = await prisma.$transaction(
      codes.map((code) =>
        prisma.referralCode.create({
          data: {
            code,
            communityName,
            stayId,
            discountPercent,
            maxUsage,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            notes,
            isActive: true,
            usageCount: 0,
          },
          include: {
            stay: {
              select: {
                id: true,
                stayId: true,
                title: true,
              },
            },
          },
        })
      )
    );

    // Log activity - using correct ActivityLog schema fields
    try {
      await prisma.activityLog.create({
        data: {
          userId: (session.user as any).id,
          action: 'CREATE_REFERRAL_CODES',
          entity: 'ReferralCode',
          entityId: stayId,
          details: {
            communityName,
            stayId: stay.stayId,
            stayTitle: stay.title,
            numberOfCodes,
            discountPercent,
            codes: codes,
            description: `Created ${numberOfCodes} referral codes for ${communityName} (${stay.title})`,
          },
        },
      });
    } catch (logError) {
      console.error('[Activity Log] Error:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Created ${numberOfCodes} referral codes for ${communityName}`,
      codes: createdCodes,
    });
  } catch (error) {
    console.error('[Admin Referrals POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create referral codes' },
      { status: 500 }
    );
  }
}