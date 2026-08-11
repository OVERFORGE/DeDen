// File: app/api/admin/stays/[id]/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';

/**
 * GET /api/admin/stays/[id]
 * Fetches a specific stay by ID
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    const stay = await db.stay.findUnique({
      where: {
        id: id,
      },
      include: {
        // Include any relations you need, e.g.:
        // sponsors: true,
        // bookings: true,
      },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(stay);
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching stay:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
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
    await requireAdmin();

    const { id } = await context.params;
    const body = await request.json();

    // Remove 'id' from body if it exists
    if (body.id) {
      delete body.id;
    }

    const dataToUpdate: any = { ...body };
    
    // --- 1. Top-Level Date/Duration Conversions ---
    if (body.startDate) {
      dataToUpdate.startDate = new Date(body.startDate);
    }
    
    if (body.endDate) {
      dataToUpdate.endDate = new Date(body.endDate);
    }

    if (dataToUpdate.startDate && dataToUpdate.endDate) {
      const diffTime = Math.abs(dataToUpdate.endDate.getTime() - dataToUpdate.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      dataToUpdate.duration = diffDays;
    }

    // --- 2. Top-Level Price/Number Conversions ---
    if (body.priceUSDC !== undefined) {
      dataToUpdate.priceUSDC = parseFloat(body.priceUSDC);
    }
    if (body.priceUSDT !== undefined) {
      dataToUpdate.priceUSDT = parseFloat(body.priceUSDT);
    }
    if (body.depositAmount !== undefined) {
      dataToUpdate.depositAmount = parseFloat(body.depositAmount);
    }

    if (body.slotsTotal !== undefined) {
      dataToUpdate.slotsTotal = parseInt(body.slotsTotal);
    }
    if (body.slotsAvailable !== undefined) {
      dataToUpdate.slotsAvailable = parseInt(body.slotsAvailable);
    }
    if (body.guestCapacity !== undefined) {
      dataToUpdate.guestCapacity = parseInt(body.guestCapacity);
    }

    // --- 3. CRITICAL ROOM ARRAY CONVERSION ---
    if (body.rooms && Array.isArray(body.rooms)) {
      dataToUpdate.rooms = body.rooms.map((room: any) => ({
        ...room,
        // Remove temporary client-side IDs if they exist (for new rooms)
        id: room.id && room.id.length > 20 ? undefined : room.id,
        // Ensure Room Prices are cleanly parsed as numbers
        priceUSDC: parseFloat(room.priceUSDC) || 0.01,
        priceUSDT: parseFloat(room.priceUSDT) || 0.01,
        capacity: parseInt(room.capacity) || 1,
        // Ensure nested arrays are safe
        images: Array.isArray(room.images) ? room.images : [],
        amenities: Array.isArray(room.amenities) ? room.amenities : [],
      }));
    } else if (body.rooms === undefined) {
      // Don't update rooms if not provided
      delete dataToUpdate.rooms;
    } else {
      // If explicitly set to null or invalid, set to empty array
      dataToUpdate.rooms = [];
    }

    // --- 4. Other Array/JSON Field Checks ---
    if (body.images !== undefined) {
      dataToUpdate.images = Array.isArray(body.images) ? body.images : [];
    }
    if (body.amenities !== undefined) {
      dataToUpdate.amenities = Array.isArray(body.amenities) ? body.amenities : [];
    }
    if (body.amenityIcons !== undefined) {
      dataToUpdate.amenityIcons = Array.isArray(body.amenityIcons) ? body.amenityIcons : [];
    }
    if (body.tags !== undefined) {
      dataToUpdate.tags = Array.isArray(body.tags) ? body.tags : [];
    }
    if (body.highlights !== undefined) {
      dataToUpdate.highlights = Array.isArray(body.highlights) ? body.highlights : [];
    }
    if (body.rules !== undefined) {
      dataToUpdate.rules = Array.isArray(body.rules) ? body.rules : [];
    }
    if (body.galleryImages !== undefined) {
      dataToUpdate.galleryImages = Array.isArray(body.galleryImages) ? body.galleryImages : [];
    }
    if (body.sponsorIds !== undefined) {
      dataToUpdate.sponsorIds = Array.isArray(body.sponsorIds) ? body.sponsorIds : [];
    }

    // --- 5. Update the Stay ---
    const updatedStay = await db.stay.update({
      where: {
        id: id,
      },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedStay);
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
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
    await requireAdmin();

    const { id } = await context.params;

    // Check if stay exists
    const stay = await db.stay.findUnique({
      where: { id },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    // Manually cascade delete related records to avoid Prisma referential integrity errors
    if ((db as any).ticket) { try { await (db as any).ticket.deleteMany({ where: { stayId: id } }); } catch (e) { console.warn('Deleting tickets warning:', e); } }
    if ((db as any).booking) { try { await (db as any).booking.deleteMany({ where: { stayId: id } }); } catch (e) { console.warn('Deleting bookings warning:', e); } }
    if ((db as any).review) { try { await (db as any).review.deleteMany({ where: { stayId: id } }); } catch (e) { console.warn('Deleting reviews warning:', e); } }
    if ((db as any).addon) { try { await (db as any).addon.deleteMany({ where: { stayId: id } }); } catch (e) { console.warn('Deleting addons warning:', e); } }
    if ((db as any).referralCode) { try { await (db as any).referralCode.deleteMany({ where: { stayId: id } }); } catch (e) { console.warn('Deleting referral codes warning:', e); } }

    // Delete the stay
    await db.stay.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Stay deleted successfully' 
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error deleting stay:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}