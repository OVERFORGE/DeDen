// File: app/lib/verification.ts

import { ethers } from 'ethers';
import { db } from '@/lib/database';
import { bscTestnetProvider } from '@/lib/providers';
import { chainConfig, treasuryAddress } from '@/lib/config';
import { sendConfirmationEmail } from '@/lib/email';
import { BookingStatus, PaymentToken } from '@prisma/client';

// 1. Define the small part of the ERC-20 ABI we need
const ERC20_TRANSFER_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const transferInterface = new ethers.Interface(ERC20_TRANSFER_ABI);

// 2. Define the number of confirmations to wait for
const REQUIRED_CONFIRMATIONS = 3;

/**
 * This is the core verification function for the NEW schema.
 * It fetches the tx, waits for confirmations, and updates the Booking record.
 * 
 * Flow:
 * 1. User submits txHash → booking.status = PENDING, booking.txHash = txHash
 * 2. This function waits for confirmations
 * 3. On success → booking.status = CONFIRMED, send confirmation email
 * 4. On failure → booking.status = FAILED
 */
export async function verifyPayment(bookingId: string, txHash: string, chainId: number) {
  
  console.log(`[VFY] Starting verification for booking ${bookingId}, tx ${txHash}`);

  // Declare booking outside try-catch so it's accessible in catch block
  let booking: Awaited<ReturnType<typeof db.booking.findUnique>> | null = null;

  try {
    // --- Step 1: Get Booking Details ---
    booking = await db.booking.findUnique({
      where: { bookingId },
      include: {
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
        stay: {
          select: {
            title: true,
            location: true,
            startDate: true,
            endDate: true,
            priceUSDC: true,
            priceUSDT: true,
          },
        },
      },
    });

    if (!booking) {
      console.error(`[VFY-ERR] Booking ${bookingId} not found.`);
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status !== BookingStatus.PENDING) {
      console.warn(`[VFY-WARN] Booking ${bookingId} is already processed. Status: ${booking.status}`);
      return;
    }

    if (!booking.paymentToken || !booking.paymentAmount) {
      throw new Error('Booking does not have payment details set');
    }

    // --- Step 2: Get Config Details ---
    const config = chainConfig[chainId];
    const tokenInfo = config?.tokens[booking.paymentToken];

    if (!config || !tokenInfo) {
      throw new Error(`Invalid config for chain ${chainId} or currency ${booking.paymentToken}`);
    }

    // --- Step 3: Calculate Expected Amount ---
    // The expected amount in base units (e.g., for 300 USDC with 6 decimals = "300000000")
    const expectedAmount = ethers.parseUnits(
      booking.paymentAmount.toString(),
      tokenInfo.decimals
    ).toString();

    // --- Step 4: Wait for Transaction Confirmations ---
    console.log(`[VFY] Waiting for ${REQUIRED_CONFIRMATIONS} confirmations for ${txHash}...`);
    
    const tx = await bscTestnetProvider.getTransaction(txHash);
    if (!tx) {
      throw new Error('Transaction not found (yet).');
    }
    
    // This is the magic! Ethers will wait for N blocks.
    const receipt = await tx.wait(REQUIRED_CONFIRMATIONS);

    if (!receipt) {
      throw new Error('Transaction receipt not found.');
    }

    // --- Step 5: Check Transaction Status ---
    if (receipt.status === 0) {
      throw new Error('Transaction failed (reverted on-chain).');
    }

    // --- Step 6: Securely Parse Event Logs ---
    console.log(`[VFY] Tx confirmed. Parsing ${receipt.logs.length} logs...`);
    
    let paymentFound = false;
    let actualFromAddress = '';
    
    for (const log of receipt.logs) {
      // Check 1: Is this a log from our token?
      if (log.address.toLowerCase() !== tokenInfo.address.toLowerCase()) {
        continue; // Not our token, skip
      }

      try {
        const parsedLog = transferInterface.parseLog(log);

        if (parsedLog && parsedLog.name === 'Transfer') {
          // Check 2: Did it go to our treasury?
          const to = parsedLog.args.to;
          if (to.toLowerCase() !== treasuryAddress?.toLowerCase()) {
            continue; // Not to us, skip
          }

          // Check 3: Was it the exact amount?
          const value = parsedLog.args.value.toString();
          if (value !== expectedAmount) {
            throw new Error(`Amount mismatch. Expected ${expectedAmount}, got ${value}`);
          }

          // Extract sender address
          actualFromAddress = parsedLog.args.from;

          // --- !! SUCCESS !! ---
          console.log(`[VFY-SUCCESS] Valid payment found for booking ${bookingId}!`);
          paymentFound = true;

          // We will update the database in a transaction
          await db.$transaction([
            // 1. Update the booking to CONFIRMED
            db.booking.update({
              where: { bookingId },
              data: {
                status: BookingStatus.CONFIRMED,
                confirmedAt: new Date(),
                txHash: txHash,
                chain: config.name,
                chainId: chainId,
                blockNumber: Number(receipt.blockNumber),
                senderAddress: actualFromAddress,
                receiverAddress: to,
                amountBaseUnits: value,
              },
            }),
            // 2. Create an activity log
            db.activityLog.create({
              data: {
                userId: booking.userId,
                bookingId: booking.id,
                action: 'payment_confirmed',
                entity: 'booking',
                entityId: booking.id,
                details: {
                  txHash,
                  chainId,
                  blockNumber: Number(receipt.blockNumber),
                  token: booking.paymentToken,
                  amount: booking.paymentAmount,
                  from: actualFromAddress,
                  to,
                },
              },
            }),
          ]);

          // 3. Send confirmation email
          if (booking.user.email) {
            try {
              await sendConfirmationEmail({
                recipientEmail: booking.user.email,
                recipientName: booking.user.displayName || 'Guest',
                bookingId: booking.bookingId,
                stayTitle: booking.stay.title,
                stayLocation: booking.stay.location,
                startDate: booking.stay.startDate,
                endDate: booking.stay.endDate,
                paidAmount: booking.paymentAmount,
                paidToken: booking.paymentToken,
                txHash,
                chainId,
              });
              console.log(`[VFY] Confirmation email sent to ${booking.user.email}`);
            } catch (emailError) {
              console.error('[VFY] Failed to send confirmation email:', emailError);
              // Don't fail the entire verification if email fails
            }
          }

          break; // Stop looping
        }
      } catch (e) {
        // This log wasn't a 'Transfer' event, ignore it
        continue;
      }
    }

    if (!paymentFound) {
      throw new Error('No valid ERC-20 Transfer event found in transaction.');
    }

  } catch (error: unknown) {
    // --- !! FAILURE !! ---
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[VFY-ERR] Verification failed for ${bookingId}:`, errorMessage);
    
    // Only update if we have a booking record
    if (booking) {
      try {
        await db.$transaction([
          // Update booking to FAILED
          db.booking.update({
            where: { bookingId },
            data: {
              status: BookingStatus.FAILED,
              txHash: txHash,
              chainId: chainId,
            },
          }),
          // Log the failure
          db.activityLog.create({
            data: {
              userId: booking.userId,
              bookingId: booking.id,
              action: 'payment_failed',
              entity: 'booking',
              entityId: booking.id,
              details: {
                txHash,
                chainId,
                error: errorMessage,
              },
            },
          }),
        ]);
      } catch (dbError) {
        console.error(`[VFY-ERR] Failed to update booking status:`, dbError);
      }
    } else {
      console.error(`[VFY-ERR] Cannot update booking status - booking not found`);
    }

    // Re-throw the error so caller knows verification failed
    throw error;
  }
}

/**
 * Helper function to check if a booking's payment session has expired
 * This can be called by a cron job to clean up expired bookings
 */
export async function checkExpiredBookings() {
  try {
    const now = new Date();
    
    // Find all PENDING bookings that have expired
    const expiredBookings = await db.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: {
          lt: now, // Less than current time
        },
      },
      include: {
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    });

    console.log(`[CRON] Found ${expiredBookings.length} expired bookings`);

    // Update them to EXPIRED
    for (const booking of expiredBookings) {
      await db.$transaction([
        db.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.EXPIRED,
          },
        }),
        db.activityLog.create({
          data: {
            userId: booking.userId,
            bookingId: booking.id,
            action: 'booking_expired',
            entity: 'booking',
            entityId: booking.id,
            details: {
              expiredAt: now.toISOString(),
              originalExpiresAt: booking.expiresAt?.toISOString(),
            },
          },
        }),
      ]);

      console.log(`[CRON] Marked booking ${booking.bookingId} as EXPIRED`);

      // TODO: Send expiration notification email
    }

    return expiredBookings.length;
  } catch (error) {
    console.error('[CRON] Error checking expired bookings:', error);
    throw error;
  }
}

/**
 * Helper function to retry failed verifications
 * Can be used manually or by a background job
 */
export async function retryFailedVerification(bookingId: string) {
  try {
    const booking = await db.booking.findUnique({
      where: { bookingId },
      select: {
        id: true,
        bookingId: true,
        status: true,
        txHash: true,
        chainId: true,
      },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status !== BookingStatus.FAILED) {
      throw new Error(`Booking ${bookingId} is not in FAILED status`);
    }

    if (!booking.txHash || !booking.chainId) {
      throw new Error(`Booking ${bookingId} is missing transaction details`);
    }

    // Reset to PENDING and retry verification
    await db.booking.update({
      where: { bookingId },
      data: {
        status: BookingStatus.PENDING,
      },
    });

    console.log(`[RETRY] Retrying verification for booking ${bookingId}`);
    await verifyPayment(bookingId, booking.txHash, booking.chainId);

    return { success: true, message: 'Verification retry initiated' };
  } catch (error) {
    console.error(`[RETRY] Failed to retry verification for ${bookingId}:`, error);
    throw error;
  }
}