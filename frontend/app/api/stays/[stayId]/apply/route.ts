// File: app/api/stays/[stayId]/apply/route.ts
// ✅ UPDATED: Now accepts custom numberOfNights from user selection

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client'; 
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; 

/**
 * Apply for a stay (join waitlist) - WITH USER-SELECTED NIGHTS
 * POST /api/stays/[stayId]/apply
 */
export async function POST(
	request: Request,
	context: { params: Promise<{ stayId: string }> }
) {
	try {
		// 1. Get Authenticated Session
		const session = await getServerSession(authOptions);
		if (!session || !session.user || !session.user.id) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}
		const userId = session.user.id;

		const { stayId } = await context.params;
		
		const body = await request.json();

		const {
			walletAddress,
			email,
			displayName,
			firstName,
			lastName,
			role,
			gender,
			age,
			mobileNumber,
			selectedRoomId,
			numberOfNights, // ✅ NEW: User-selected nights
			socialTwitter,
			socialTelegram,
			socialLinkedin,
		} = body;

		// 2. Validation
		if (!stayId || stayId === 'undefined') {
			return NextResponse.json(
				{ error: 'A valid stayId is required in the URL' },
				{ status: 400 }
			);
		}

		if (!walletAddress || !gender || !age || !mobileNumber || !email || !displayName) {
			return NextResponse.json(
				{ error: 'Missing required fields: walletAddress, email, displayName, gender, age, mobileNumber' },
				{ status: 400 }
			);
		}

		if (age < 18) {
			return NextResponse.json(
				{ error: 'You must be at least 18 years old to apply' },
				{ status: 400 }
			);
		}

		// ✅ NEW: Validate numberOfNights
		if (!numberOfNights || numberOfNights < 1) {
			return NextResponse.json(
				{ error: 'Please select at least 1 night' },
				{ status: 400 }
			);
		}

		// 3. Find the Stay
		const stay = await db.stay.findUnique({
			where: { stayId: stayId },
		});

		if (!stay) {
			return NextResponse.json(
				{ error: `Stay with ID '${stayId}' not found` },
				{ status: 404 }
			);
		}

		if (!stay.allowWaitlist) {
			return NextResponse.json(
				{ error: 'This stay is not accepting applications' },
				{ status: 400 }
			);
		}

		// ✅ NEW: Validate that selected nights don't exceed stay duration
		const stayDuration = stay.duration || Math.ceil(
			(new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) / (1000 * 60 * 60 * 24)
		);

		if (numberOfNights > stayDuration) {
			return NextResponse.json(
				{ error: `Cannot book more than ${stayDuration} nights for this stay` },
				{ status: 400 }
			);
		}

		console.log(`[Apply] User selected ${numberOfNights} nights (Stay has ${stayDuration} nights total)`);

		// ============================================
		// ✅ UPDATED: Find selected room & calculate price based on USER-SELECTED nights
		// ============================================
		let pricePerNightUSDC: number | null = null;
		let pricePerNightUSDT: number | null = null;
		let totalPriceUSDC: number | null = null;
		let totalPriceUSDT: number | null = null;
		let roomName: string | null = null;

		if (selectedRoomId) {
			const rooms = (stay.rooms as any[]) || [];
			const selectedRoom = rooms.find((r: any) => r.id === selectedRoomId);
			
			if (selectedRoom) {
				// Room prices are PER NIGHT
			pricePerNightUSDC = selectedRoom.priceUSDC ?? stay.priceUSDC;
                        pricePerNightUSDT = selectedRoom.priceUSDT ?? stay.priceUSDT;
				
			if (typeof pricePerNightUSDC !== 'number' || typeof pricePerNightUSDT !== 'number') {
                            console.error(`[Apply] Invalid price for room ${selectedRoomId}.`);
                            return NextResponse.json({ error: "Could not determine price for selected room" }, { status: 500 });
                        }
                        
                        // ✅ Calculate TOTAL using USER-SELECTED nights (NOW SAFE)
                        totalPriceUSDC = pricePerNightUSDC * numberOfNights;
                        totalPriceUSDT = pricePerNightUSDT * numberOfNights;
				roomName = selectedRoom.name;

				console.log(`[Apply] Room: ${roomName}`);
				console.log(`[Apply] Price per night: $${pricePerNightUSDC} USDC / $${pricePerNightUSDT} USDT`);
				console.log(`[Apply] Total for ${numberOfNights} nights: $${totalPriceUSDC} USDC / $${totalPriceUSDT} USDT`);
			}
		} else {
			// No room selected - use default stay prices
			pricePerNightUSDC = stay.priceUSDC;
			pricePerNightUSDT = stay.priceUSDT;
			totalPriceUSDC = pricePerNightUSDC * numberOfNights;
			totalPriceUSDT = pricePerNightUSDT * numberOfNights;

			console.log(`[Apply] No room preference - using default prices`);
			console.log(`[Apply] Total for ${numberOfNights} nights: $${totalPriceUSDC} USDC / $${totalPriceUSDT} USDT`);
		}

		// 5. Get & Update Authenticated User
		const emailConflict = await db.user.findFirst({
			where: {
				email: email,
				id: { not: userId },
			},
		});

		if (emailConflict) {
			return NextResponse.json(
				{ error: 'This email is already registered with another account.' },
				{ status: 409 }
			);
		}

		const user = await db.user.update({
			where: { id: userId },
			data: {
				displayName: displayName,
				email: email,
				firstName: firstName,
				lastName: lastName,
				role: role,
				gender: gender,
				age: age,
				mobileNumber: mobileNumber,
				socialTwitter: socialTwitter,
				socialTelegram: socialTelegram,
				socialLinkedin: socialLinkedin,
				walletAddress: walletAddress,
			},
		});
		
		
		// 6. Check for existing booking
		const existingBooking = await db.booking.findFirst({
			where: {
				userId: user.id,
				stayId: stay.id,
			},
			select: {
				id: true,
				bookingId: true,
				status: true
			}
		});

		if (existingBooking) {
			const isTerminalStatus = 
				existingBooking.status === BookingStatus.FAILED ||
				existingBooking.status === BookingStatus.EXPIRED ||
				existingBooking.status === BookingStatus.CANCELLED ||
				existingBooking.status === BookingStatus.REFUNDED;

			if (isTerminalStatus) {
				// Update old booking
				const updatedBooking = await db.booking.update({
					where: { id: existingBooking.id },
					data: {
						status: BookingStatus.WAITLISTED,
						preferredRoomId: selectedRoomId || null,
						selectedRoomId: selectedRoomId || null,
						// ✅ UPDATED: Store user-selected nights
						numberOfNights: numberOfNights,
						pricePerNightUSDC: pricePerNightUSDC,
						pricePerNightUSDT: pricePerNightUSDT,
						// ✅ UPDATED: Store calculated totals
						selectedRoomPriceUSDC: totalPriceUSDC,  
						selectedRoomPriceUSDT: totalPriceUSDT,  
						selectedRoomName: roomName,
						guestName: user.displayName,
						guestEmail: user.email,
						guestGender: gender,
						guestAge: age,
						guestMobile: mobileNumber,
						// Clear payment fields
						paymentToken: null,
						paymentAmount: null,
						txHash: null,
						chainId: null,
						expiresAt: null,
						confirmedAt: null,
					}
				});
				
				return NextResponse.json(
					{
						success: true,
						message: 'Application re-submitted successfully. Check your dashboard for status updates.',
						booking: {
							bookingId: updatedBooking.bookingId,
							status: updatedBooking.status,
							stayTitle: stay.title,
							selectedRoomName: roomName,
							numberOfNights: numberOfNights,
							pricePerNightUSDC: pricePerNightUSDC,
							pricePerNightUSDT: pricePerNightUSDT,
							totalPriceUSDC: totalPriceUSDC,
							totalPriceUSDT: totalPriceUSDT,
						},
					},
					{ status: 201 }
				);

			} else {
				return NextResponse.json(
					{
						error: `You have an active application for this stay. Status: ${existingBooking.status}. Check your dashboard for details.`,
						bookingId: existingBooking.bookingId,
						status: existingBooking.status,
					},
					{ status: 409 }
				);
			}
		}


		// 7. Create NEW Booking
		const randomId = `${stayId}-${Date.now()}`;

		const newBooking = await db.booking.create({
			data: {
				bookingId: randomId,
				status: BookingStatus.WAITLISTED,
				userId: user.id,
				stayId: stay.id,
				guestName: user.displayName,
				guestEmail: user.email,
				guestGender: gender,
				guestAge: age,
				guestMobile: mobileNumber,
				preferredRoomId: selectedRoomId || null,
				selectedRoomId: selectedRoomId || null,
				// ✅ UPDATED: Store user-selected nights
				numberOfNights: numberOfNights,
				pricePerNightUSDC: pricePerNightUSDC,
				pricePerNightUSDT: pricePerNightUSDT,
				// ✅ UPDATED: Store calculated totals
				selectedRoomPriceUSDC: totalPriceUSDC, 
				selectedRoomPriceUSDT: totalPriceUSDT, 
				selectedRoomName: roomName,
				guestCount: 1,
				optInGuestList: false,
				shareContactInfo: false, 
				contentReuseConsent: false, 
				needsTravelHelp: false, 
			},
		});

		// 8. Log Activity
		await db.activityLog.create({
			data: {
				userId: user.id,
				bookingId: newBooking.id,
				action: 'application_submitted',
				entity: 'booking',
				entityId: newBooking.id,
				details: {
					stayId: stay.stayId,
					email: user.email,
					walletAddress: walletAddress,
					gender: gender,
					age: age,
					mobileNumber: mobileNumber,
					selectedRoomId: selectedRoomId,
					selectedRoomName: roomName,
					numberOfNights: numberOfNights, // ✅ Log selected nights
					pricePerNightUSDC: pricePerNightUSDC,
					pricePerNightUSDT: pricePerNightUSDT,
					totalPriceUSDC: totalPriceUSDC,
					totalPriceUSDT: totalPriceUSDT,
				},
			},
		});

		// 9. Return Success
		return NextResponse.json(
			{
				success: true,
				message: 'Application submitted successfully. Check your dashboard for status updates.',
				booking: {
					bookingId: newBooking.bookingId,
					status: newBooking.status,
					stayTitle: stay.title,
					selectedRoomName: roomName,
					numberOfNights: numberOfNights,
					pricePerNightUSDC: pricePerNightUSDC,
					pricePerNightUSDT: pricePerNightUSDT,
					totalPriceUSDC: totalPriceUSDC,
					totalPriceUSDT: totalPriceUSDT,
				},
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('[Apply API Error]:', error);
		
		if ((error as any).name === 'PrismaClientValidationError') {
			return NextResponse.json(
				{ error: 'Invalid data provided to database' },
				{ status: 400 }
			);
		}

		if ((error as any).code === 'P2002') {
			const meta = (error as any).meta;
			if (meta?.target?.includes('email')) {
				return NextResponse.json(
					{ error: 'This email is already registered. Please use a different email or sign in.' },
					{ status: 409 }
				);
			}
			return NextResponse.json(
				{ error: 'You have already applied for this stay' },
				{ status: 409 }
			);
		}

		return NextResponse.json(
			{ error: 'Internal server error', details: (error as Error).message },
			{ status: 500 }
		);
	}
}