import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/stays/[stayId]
 * Fetches public details for a single stay,
 * including the room options for the apply page.
 */
export async function GET(
  request: Request,
  // 💡 FIX 1: Use the Promise-based context your other routes use
  context: { params: Promise<{ stayId: string }> } 
) {
  try {
    // 💡 FIX 2: Add 'await' to unwrap the promise
    const { stayId } = await context.params; 

    if (!stayId) {
      return NextResponse.json(
        { error: 'Stay ID not provided' },
        { status: 400 }
      );
    }

    const stay = await db.stay.findUnique({
      where: { stayId: stayId },
      select: {
        // Select only the fields needed by the ApplyPage
        stayId: true,
        title: true,
        // ⭐️ This is the all-important line that includes the rooms
        rooms: true 
      },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    // Return the full stay object, which now includes the rooms
    return NextResponse.json(stay);

  } catch (error) {
    console.error('[API] Error fetching stay details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}