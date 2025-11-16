// File: app/api/admin/referrals/[id]/route.ts
// Updated for Next.js 15+ (params is now a Promise)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * PATCH /api/admin/referrals/[id]
 * Update a referral code (toggle active status, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // ✅ NEXT.JS 15+: Await params
    const { id } = await params;
    const body = await request.json();

    // Verify referral code exists
    const existingCode = await prisma.referralCode.findUnique({
      where: { id },
      include: {
        stay: {
          select: {
            stayId: true,
            title: true,
          },
        },
      },
    });

    if (!existingCode) {
      return NextResponse.json(
        { error: 'Referral code not found' },
        { status: 404 }
      );
    }

    // Update the code
    const updatedCode = await prisma.referralCode.update({
      where: { id },
      data: {
        isActive: body.isActive !== undefined ? body.isActive : existingCode.isActive,
        discountPercent: body.discountPercent || existingCode.discountPercent,
        maxUsage: body.maxUsage !== undefined ? body.maxUsage : existingCode.maxUsage,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : existingCode.expiresAt,
        notes: body.notes !== undefined ? body.notes : existingCode.notes,
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
    });

    // Log activity - using correct ActivityLog schema fields
    try {
      await prisma.activityLog.create({
        data: {
          userId: (session.user as any).id,
          action: 'UPDATE_REFERRAL_CODE',
          entity: 'ReferralCode',
          entityId: id,
          details: {
            code: existingCode.code,
            communityName: existingCode.communityName,
            stayId: existingCode.stayId,
            stayTitle: existingCode.stay?.title,
            changes: body,
            description: `Updated referral code ${existingCode.code} (${existingCode.communityName})`,
          },
        },
      });
    } catch (logError) {
      console.error('[Activity Log] Error:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code updated successfully',
      code: updatedCode,
    });
  } catch (error) {
    console.error('[Admin Referrals PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update referral code' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/referrals/[id]
 * Delete a referral code (use with caution - consider soft delete instead)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // ✅ NEXT.JS 15+: Await params
    const { id } = await params;

    // Check if code has been used
    const code = await prisma.referralCode.findUnique({
      where: { id },
      include: {
        bookings: true,
        stay: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!code) {
      return NextResponse.json(
        { error: 'Referral code not found' },
        { status: 404 }
      );
    }

    if (code.bookings.length > 0) {
      // Don't delete codes that have been used - deactivate instead
      await prisma.referralCode.update({
        where: { id },
        data: { isActive: false },
      });

      // Log deactivation
      try {
        await prisma.activityLog.create({
          data: {
            userId: (session.user as any).id,
            action: 'DEACTIVATE_REFERRAL_CODE',
            entity: 'ReferralCode',
            entityId: id,
            details: {
              code: code.code,
              communityName: code.communityName,
              stayTitle: code.stay?.title,
              bookingsCount: code.bookings.length,
              description: `Deactivated referral code ${code.code} (${code.communityName}) instead of deleting - has ${code.bookings.length} booking(s)`,
            },
          },
        });
      } catch (logError) {
        console.error('[Activity Log] Error:', logError);
      }

      return NextResponse.json({
        success: true,
        message: 'Referral code has bookings and was deactivated instead of deleted',
        deactivated: true,
      });
    }

    // Delete the code if unused
    await prisma.referralCode.delete({
      where: { id },
    });

    // Log deletion
    try {
      await prisma.activityLog.create({
        data: {
          userId: (session.user as any).id,
          action: 'DELETE_REFERRAL_CODE',
          entity: 'ReferralCode',
          entityId: id,
          details: {
            code: code.code,
            communityName: code.communityName,
            stayTitle: code.stay?.title,
            description: `Deleted unused referral code ${code.code} (${code.communityName})`,
          },
        },
      });
    } catch (logError) {
      console.error('[Activity Log] Error:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code deleted successfully',
    });
  } catch (error) {
    console.error('[Admin Referrals DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete referral code' },
      { status: 500 }
    );
  }
}