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

export async function verifyPayment(bookingId: string, txHash: string, chainId: number) {
  
  console.log(`[VFY] Starting verification for booking ${bookingId}, tx ${txHash}`);

  // Declare booking with proper type that includes relations
  let booking: {
    id: string;
    bookingId: string;
    userId: string;
    status: BookingStatus;
    paymentToken: PaymentToken | null;
    paymentAmount: number | null;
    user: {
      email: string | null;
      displayName: string | null;
    };
    stay: {
      title: string;
      location: string;
      startDate: Date;
      endDate: Date;
      priceUSDC: number;
      priceUSDT: number;
    };
  } | null = null;

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
      if (log.address.toLowerCase() !== tokenInfo.address.toLowerCase()) {
        continue;
      }

      try {
        const parsedLog = transferInterface.parseLog(log);

        if (parsedLog && parsedLog.name === 'Transfer') {
          const to = parsedLog.args.to;
          if (to.toLowerCase() !== treasuryAddress?.toLowerCase()) {
            continue;
          }

          const value = parsedLog.args.value.toString();
          if (value !== expectedAmount) {
            throw new Error(`Amount mismatch. Expected ${expectedAmount}, got ${value}`);
          }

          actualFromAddress = parsedLog.args.from;

          console.log(`[VFY-SUCCESS] Valid payment found for booking ${bookingId}!`);
          paymentFound = true;

          // Store user data before transaction
          const userEmail = booking.user.email;
          const userDisplayName = booking.user.displayName;
          const stayData = {
            title: booking.stay.title,
            location: booking.stay.location,
            startDate: booking.stay.startDate,
            endDate: booking.stay.endDate,
          };
          const paymentData = {
            amount: booking.paymentAmount,
            token: booking.paymentToken,
          };

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
                  token: paymentData.token,
                  amount: paymentData.amount,
                  from: actualFromAddress,
                  to,
                },
              },
            }),
          ]);

          // 3. Send confirmation email (outside transaction)
          if (userEmail) {
            try {
              await sendConfirmationEmail({
                recipientEmail: userEmail,
                recipientName: userDisplayName || 'Guest',
                bookingId: bookingId,
                stayTitle: stayData.title,
                stayLocation: stayData.location,
                startDate: stayData.startDate,
                endDate: stayData.endDate,
                paidAmount: paymentData.amount,
                paidToken: paymentData.token,
                txHash,
                chainId,
              });
              console.log(`[VFY] Confirmation email sent to ${userEmail}`);
            } catch (emailError) {
              console.error('[VFY] Failed to send confirmation email:', emailError);
              // Don't fail the entire verification if email fails
            }
          }

          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!paymentFound) {
      throw new Error('No valid ERC-20 Transfer event found in transaction.');
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[VFY-ERR] Verification failed for ${bookingId}:`, errorMessage);
    
    if (booking) {
      try {
        await db.$transaction([
          db.booking.update({
            where: { bookingId },
            data: {
              status: BookingStatus.FAILED,
              txHash: txHash,
              chainId: chainId,
            },
          }),
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

    throw error;
  }
}

export async function checkExpiredBookings() {
  try {
    const now = new Date();
    
    const expiredBookings = await db.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: {
          lt: now,
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
    }

    return expiredBookings.length;
  } catch (error) {
    console.error('[CRON] Error checking expired bookings:', error);
    throw error;
  }
}

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