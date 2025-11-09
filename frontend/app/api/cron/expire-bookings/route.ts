// File: app/api/cron/expire-bookings/route.ts

import { NextResponse } from 'next/server';
import { checkExpiredBookings } from '@/lib/verification';

/**
 * Cron job endpoint to expire PENDING bookings
 * GET /api/cron/expire-bookings
 *
 * Can be triggered by a service like Vercel Cron Jobs.
 * e.g., "0 * * * *" (once per hour)
 */
export async function GET(request: Request) {
  // Optional: Add cron job security
  // const cronSecret = process.env.CRON_SECRET;
  // const authHeader = request.headers.get('authorization');
  // if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const expiredCount = await checkExpiredBookings();

    return NextResponse.json({
      success: true,
      message: `Checked for expired bookings. ${expiredCount} bookings marked as EXPIRED.`,
    });
  } catch (error: any) {
    console.error('[CRON] Error expiring bookings:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}