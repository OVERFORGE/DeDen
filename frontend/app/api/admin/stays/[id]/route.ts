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

    // Strip anything that isn't a writable Stay column.
    //
    // Prisma turns each field into its own MongoDB aggregation stage, and
    // Atlas hard-caps pipelines at 50 stages. Stay has 58 columns, so a
    // client that echoes the whole record back (which the edit form used to
    // do) blows the limit and every save 500s with
    // "Pipeline length greater than 50 not supported". Filtering to real,
    // changed columns keeps updates small and also stops relation/meta
    // fields (id, createdAt, bookings, …) reaching Prisma.
    const IMMUTABLE = new Set(['id', '_id', 'createdAt', 'updatedAt', 'bookings', 'tickets', 'referralCodes']);
    for (const key of Object.keys(body)) {
      if (IMMUTABLE.has(key)) delete body[key];
    }

    const dataToUpdate: any = { ...body };
    
    // --- 1. Top-Level Date/Duration Conversions ---
    if (body.startDate) {
      dataToUpdate.startDate = new Date(body.startDate);
    }
    
    if (body.endDate) {
      dataToUpdate.endDate = new Date(body.endDate);
    }

    // Mandatory-core dates: blank means "no required nights", so normalise
    // empty strings to null rather than an Invalid Date.
    for (const key of ['coreStartDate', 'coreEndDate'] as const) {
      if (body[key] !== undefined) {
        dataToUpdate[key] = body[key] ? new Date(body[key]) : null;
      }
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

    // --- 5. Narrow to fields that actually changed ---
    //
    // Prisma emits one aggregation stage per updated field and Atlas caps
    // pipelines at 50, so a caller sending the whole 58-column record fails
    // outright. Diffing here means the write is always proportional to what
    // genuinely changed, regardless of how much the client sent.
    const existing = await db.stay.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }

    // --- 5b. Validate the mandatory-core range against the stay window ---
    //
    // A core that sits outside the window (or is inverted) would make the
    // stay impossible to book — no guest range could ever satisfy both
    // constraints — and the failure would only surface as a confusing
    // rejection on the apply form. Catch it here instead.
    const mergedStart = new Date((dataToUpdate.startDate ?? existing.startDate) as any);
    const mergedEnd = new Date((dataToUpdate.endDate ?? existing.endDate) as any);
    const rawCoreStart = dataToUpdate.coreStartDate ?? (existing as any).coreStartDate;
    const rawCoreEnd = dataToUpdate.coreEndDate ?? (existing as any).coreEndDate;

    if (rawCoreStart && rawCoreEnd) {
      const coreStart = new Date(rawCoreStart as any);
      const coreEnd = new Date(rawCoreEnd as any);

      if (Number.isNaN(coreStart.getTime()) || Number.isNaN(coreEnd.getTime())) {
        return NextResponse.json({ error: 'Required-nights dates are not valid dates' }, { status: 400 });
      }
      if (coreEnd.getTime() <= coreStart.getTime()) {
        return NextResponse.json(
          { error: 'Required-nights end must be after required-nights start' },
          { status: 400 }
        );
      }
      if (coreStart.getTime() < mergedStart.getTime() || coreEnd.getTime() > mergedEnd.getTime()) {
        return NextResponse.json(
          { error: 'Required nights must fall inside the stay window' },
          { status: 400 }
        );
      }
    } else if ((rawCoreStart && !rawCoreEnd) || (!rawCoreStart && rawCoreEnd)) {
      return NextResponse.json(
        { error: 'Set both required-nights dates, or leave both empty' },
        { status: 400 }
      );
    }

    const changedData: any = {};
    for (const [key, value] of Object.entries(dataToUpdate)) {
      const before = (existing as any)[key];
      const isSame =
        before instanceof Date && (value instanceof Date || typeof value === 'string')
          ? before.getTime() === new Date(value as any).getTime()
          : JSON.stringify(before ?? null) === JSON.stringify(value ?? null);

      if (!isSame) changedData[key] = value;
    }

    if (Object.keys(changedData).length === 0) {
      return NextResponse.json(existing);
    }

    // --- 6. Update the Stay ---
    const updatedStay = await db.stay.update({
      where: {
        id: id,
      },
      data: changedData,
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