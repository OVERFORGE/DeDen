// File: app/api/admin/stays/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/admin/stays
 * Fetches all stays for the admin panel
 */
export async function GET() {
  try {
    const stays = await db.stay.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        stayId: true,
        slug: true,
        title: true,
        location: true,
        startDate: true,
        endDate: true,
        isPublished: true,
        isFeatured: true,
        slotsAvailable: true,
        slotsTotal: true,
        priceUSDC: true,
        priceUSDT: true,
        createdAt: true,
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

/**
 * POST /api/admin/stays
 * Creates a new stay
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ✅ FIX: Process and validate the data before creating
    const dataToCreate: any = {
      // Required fields
      title: body.title,
      slug: body.slug,
      location: body.location,
      
      // ✅ Convert date strings to DateTime objects
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      
      // ✅ Convert strings to numbers
      priceUSDC: parseFloat(body.priceUSDC),
      priceUSDT: parseFloat(body.priceUSDT),
      slotsTotal: parseInt(body.slotsTotal),
      slotsAvailable: parseInt(body.slotsTotal), // Default: all slots available
      
      // ✅ Calculate duration
      duration: Math.ceil((new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / (1000 * 60 * 60 * 24)),
      
      // ✅ Generate stayId if not provided
      stayId: body.stayId || `${body.slug.toUpperCase()}-${new Date().getFullYear()}`,
      
      // Optional fields with defaults
      description: body.description || '',
      shortDescription: body.shortDescription || '',
      venue: body.venue || null,
      guestCapacity: body.guestCapacity ? parseInt(body.guestCapacity) : parseInt(body.slotsTotal),
      
      // Arrays - ensure they're arrays
      images: body.images || [],
      amenities: body.amenities || [],
      rooms: body.rooms || [],
      galleryImages: body.galleryImages || [],
      highlights: body.highlights || [],
      rules: body.rules || [],
      tags: body.tags || [],
      sponsorIds: body.sponsorIds || [],
      
      // Booleans
      isPublished: body.isPublished ?? false,
      isFeatured: body.isFeatured ?? false,
      allowWaitlist: body.allowWaitlist ?? true,
      autoConfirm: body.autoConfirm ?? false,
      
      // Optional fields
      heroImage: body.heroImage || null,
      videoUrl: body.videoUrl || null,
      depositAmount: body.depositAmount ? parseFloat(body.depositAmount) : null,
      checkInTime: body.checkInTime || null,
      checkOutTime: body.checkOutTime || null,
      metaTitle: body.metaTitle || body.title,
      metaDescription: body.metaDescription || body.description,
      
      // JSON fields
      programHighlights: body.programHighlights || null,
      address: body.address || null,
      cancellationPolicy: body.cancellationPolicy || null,
      metadata: body.metadata || null,
    };

    const newStay = await db.stay.create({
      data: dataToCreate,
    });

    return NextResponse.json(newStay, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating stay:', error);
    
    // Handle unique constraint violations
    if ((error as any).code === 'P2002') {
      const field = (error as any).meta?.target?.[0] || 'field';
      return NextResponse.json(
        { error: `A stay with this ${field} already exists` },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}