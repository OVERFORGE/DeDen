// app/api/admin/stays/[id]/chains/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { SUPPORTED_CHAINS } from '@/lib/config';

// ✅ FIXED: Properly handle async params
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Await the entire params object first
    const params = await context.params;
    const stayId = params.id;
    
    console.log('[API] Updating chains for stay:', stayId); // Debug log
    
    const body = await request.json();
    const { enabledChains } = body;

    // Validate input
    if (!Array.isArray(enabledChains)) {
      return NextResponse.json(
        { error: 'enabledChains must be an array' },
        { status: 400 }
      );
    }

    if (enabledChains.length === 0) {
      return NextResponse.json(
        { error: 'At least one chain must be enabled' },
        { status: 400 }
      );
    }

    // Validate all chainIds are numbers and supported
    const invalidChains = enabledChains.filter(
      (chainId: unknown) => typeof chainId !== 'number' || !SUPPORTED_CHAINS.includes(chainId)
    );

    if (invalidChains.length > 0) {
      return NextResponse.json(
        { error: `Invalid chain IDs: ${invalidChains.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate stayId is not undefined
    if (!stayId) {
      console.error('[API] Stay ID is undefined');
      return NextResponse.json(
        { error: 'Stay ID is required' },
        { status: 400 }
      );
    }

    console.log('[API] Updating stay with enabledChains:', enabledChains); // Debug log

    // Update the stay using the resolved stayId
    const updated = await db.stay.update({
      where: { id: stayId },
      data: { 
        enabledChains: enabledChains as number[] 
      },
    });

    return NextResponse.json({ 
      success: true, 
      stay: {
        id: updated.id,
        stayId: updated.stayId,
        title: updated.title,
        enabledChains: updated.enabledChains,
      }
    });
  } catch (error: any) {
    console.error('[API] Error updating enabled chains:', error);
    
    // Handle Prisma-specific errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ✅ FIXED: GET endpoint with properly handled async params
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Await the entire params object first
    const params = await context.params;
    const stayId = params.id;
    
    if (!stayId) {
      return NextResponse.json(
        { error: 'Stay ID is required' },
        { status: 400 }
      );
    }
    
    const stay = await db.stay.findUnique({
      where: { id: stayId },
      select: {
        id: true,
        stayId: true,
        title: true,
        enabledChains: true,
      },
    });

    if (!stay) {
      return NextResponse.json(
        { error: 'Stay not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      stay 
    });
  } catch (error) {
    console.error('[API] Error fetching stay chains:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}