import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const stays = await db.stay.findMany({
      where: {
        isPublished: true,
        status: { not: "DONE" },
        endDate: { gte: now },
      },
      orderBy: {
        startDate: 'asc',
      },
      select: {
        id: true,
        stayId: true,
        title: true,
        location: true,
        startDate: true,
        endDate: true,
        priceUSDC: true,
        images: true,
        heroImage: true,
        slug: true,
      },
    });

    return NextResponse.json(stays);
  } catch (error) {
    console.error('[API] Error fetching stays:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
