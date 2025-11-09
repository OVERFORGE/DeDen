// File: app/api/admin/stays/[id]/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/admin/stays/[id]
 * Fetches a single stay's details for an edit page
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ FIX 1: Await params in Next.js 15
    const { id } = await context.params;
    
    const stay = await db.stay.findUnique({
      where: {
        id: id,
      },
    });

    if (!stay) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }

    // ✅ FIX 2: Convert dates to ISO strings for the frontend
    const stayWithFormattedDates = {
      ...stay,
      startDate: stay.startDate.toISOString().split('T')[0], // YYYY-MM-DD
      endDate: stay.endDate.toISOString().split('T')[0],
    };

    return NextResponse.json(stayWithFormattedDates);
  } catch (error) {
    console.error('[API] Error fetching stay:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/stays/[id]
 * Updates a specific stay
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ FIX 1: Await params in Next.js 15
    const { id } = await context.params;
    const body = await request.json();

    // Remove 'id' from body if it exists
    if (body.id) {
      delete body.id;
    }

    // ✅ FIX 2: Convert date strings to proper DateTime objects
    const dataToUpdate: any = { ...body };
    
    if (body.startDate) {
      dataToUpdate.startDate = new Date(body.startDate);
    }
    
    if (body.endDate) {
      dataToUpdate.endDate = new Date(body.endDate);
    }

    // ✅ FIX 3: Calculate duration if dates are present
    if (dataToUpdate.startDate && dataToUpdate.endDate) {
      const diffTime = Math.abs(dataToUpdate.endDate - dataToUpdate.startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      dataToUpdate.duration = diffDays;
    }

    // ✅ FIX 4: Convert price strings to numbers
    if (body.priceUSDC) {
      dataToUpdate.priceUSDC = parseFloat(body.priceUSDC);
    }
    if (body.priceUSDT) {
      dataToUpdate.priceUSDT = parseFloat(body.priceUSDT);
    }
    if (body.depositAmount) {
      dataToUpdate.depositAmount = parseFloat(body.depositAmount);
    }

    // ✅ FIX 5: Convert number strings to integers
    if (body.slotsTotal) {
      dataToUpdate.slotsTotal = parseInt(body.slotsTotal);
    }
    if (body.slotsAvailable) {
      dataToUpdate.slotsAvailable = parseInt(body.slotsAvailable);
    }
    if (body.guestCapacity) {
      dataToUpdate.guestCapacity = parseInt(body.guestCapacity);
    }

    // ✅ FIX 6: Ensure arrays and JSON fields are properly formatted
    if (body.images && !Array.isArray(body.images)) {
      dataToUpdate.images = [];
    }
    if (body.amenities && !Array.isArray(body.amenities)) {
      dataToUpdate.amenities = [];
    }
    if (body.rooms && !Array.isArray(body.rooms)) {
      dataToUpdate.rooms = [];
    }
    if (body.tags && !Array.isArray(body.tags)) {
      dataToUpdate.tags = [];
    }
    if (body.highlights && !Array.isArray(body.highlights)) {
      dataToUpdate.highlights = [];
    }
    if (body.rules && !Array.isArray(body.rules)) {
      dataToUpdate.rules = [];
    }
    if (body.galleryImages && !Array.isArray(body.galleryImages)) {
      dataToUpdate.galleryImages = [];
    }
    if (body.sponsorIds && !Array.isArray(body.sponsorIds)) {
      dataToUpdate.sponsorIds = [];
    }

    const updatedStay = await db.stay.update({
      where: {
        id: id,
      },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedStay);
  } catch (error) {
    console.error('[API] Error updating stay:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/stays/[id]
 * Deletes a specific stay
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ FIX 1: Await params in Next.js 15
    const { id } = await context.params;

    await db.stay.delete({
      where: {
        id: id,
      },
    });

    return NextResponse.json({ message: 'Stay deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting stay:', error);
    
    // Handle specific error if booking is associated
    if ((error as any).code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete stay. It has associated bookings.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}