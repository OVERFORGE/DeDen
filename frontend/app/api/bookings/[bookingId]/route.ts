// File: app/api/bookings/[bookingId]/route.ts
// ✅ UPDATED: Includes reservation fields + enabledChains for chain filtering

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * GET /api/bookings/[bookingId]
 * Fetches the details for a single booking, e.g., for the payment page.
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ bookingId: string }> }
) {
    try {
        const { bookingId } = await context.params;

        if (!bookingId) {
            return NextResponse.json(
                { error: 'Booking ID not provided' },
                { status: 400 }
            );
        }

        // 2. --- FETCH BOOKING ---
        const booking = await db.booking.findUnique({
            where: { bookingId },
            select: {
                userId: true, 
                bookingId: true,
                status: true,
                txHash: true,
                expiresAt: true,
                
                // Payment Details
                paymentToken: true,
                paymentAmount: true,
                amountBaseUnits: true,
                chain: true,
                chainId: true,
                
                // Selected Room Prices
                selectedRoomPriceUSDC: true,
                selectedRoomPriceUSDT: true,
                selectedRoomName: true,

                // ✅ Reservation Fields (CRITICAL for Payment Page)
                requiresReservation: true,
                reservationAmount: true,
                reservationPaid: true,
                remainingAmount: true,
                remainingPaid: true,
                numberOfNights: true,

                // ✅ Stay relation with enabledChains
                stay: {
                    select: {
                        title: true,
                        priceUSDC: true,
                        priceUSDT: true,
                        enabledChains: true, // ✅ CRITICAL: Added for chain filtering
                    },
                },
            },
        });

        if (!booking) {
            return NextResponse.json(
                { error: 'Booking not found' },
                { status: 404 }
            );
        }

        // Remove userId before sending to client if not needed
        const { userId: _, ...safeBooking } = booking;

        return NextResponse.json(safeBooking);
    } catch (error) {
        console.error('[API] Error fetching booking details:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}