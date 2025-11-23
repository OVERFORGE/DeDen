// File: lib/verification.ts
// ✅ UPDATED: Handles reservation and remaining payment verification with correct status transitions

import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { getPublicClient } from './web3-client';
import { chainConfig, treasuryAddress } from './config';
import { parseUnits } from 'viem';
import { sendConfirmationEmail, sendReservationConfirmedEmail } from './email';

/**
 * Check if a transaction hash has already been used
 */
export async function checkTransactionUsed(txHash: string): Promise<boolean> {
  const existingBooking = await db.booking.findFirst({
    where: {
      OR: [
        { txHash: txHash, status: BookingStatus.CONFIRMED },
        { reservationTxHash: txHash, reservationPaid: true },
        { remainingTxHash: txHash, remainingPaid: true },
      ],
    },
  });
  
  return !!existingBooking;
}

/**
 * Verify a payment transaction on the blockchain with retries
 * ✅ UPDATED: Handles both reservation and remaining payments
 */
export async function verifyPayment(
  bookingId: string,
  txHash: string,
  chainId: number,
  isRemainingPayment: boolean = false, // ✅ NEW: Flag to indicate remaining payment
  maxRetries: number = 10,
  retryDelayMs: number = 3000
): Promise<void> {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(`\n========================================`);
      console.log(`[Verification] Attempt ${retryCount + 1}/${maxRetries}`);
      console.log(`[Verification] Chain: ${chainId} (${chainConfig[chainId]?.name || 'Unknown'})`);
      console.log(`[Verification] Booking: ${bookingId}`);
      console.log(`[Verification] TxHash: ${txHash}`);
      console.log(`[Verification] Is Remaining Payment: ${isRemainingPayment}`);
      console.log(`========================================\n`);
      
      // 1. Get the booking details
      const booking = await db.booking.findUnique({
        where: { bookingId },
        include: { 
          user: true,
          stay: true,
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // ✅ NEW: Check if this is reservation or remaining payment
      const isReservationPayment = booking.requiresReservation && !booking.reservationPaid && !isRemainingPayment;
      
      console.log(`[Verification] Requires Reservation: ${booking.requiresReservation}`);
      console.log(`[Verification] Reservation Paid: ${booking.reservationPaid}`);
      console.log(`[Verification] Processing as ${isReservationPayment ? 'RESERVATION' : isRemainingPayment ? 'REMAINING' : 'FULL'} payment`);

      // 2. Determine expected amount based on payment type
      let expectedAmount: number;
      let paymentToken: string;
      
      if (isReservationPayment) {
        // This is a reservation payment
        expectedAmount = booking.reservationAmount!;
        paymentToken = booking.reservationToken || booking.paymentToken || 'USDC';
        
        console.log(`[Verification] 💰 RESERVATION Payment: $${expectedAmount} ${paymentToken}`);
        
        if (booking.status === BookingStatus.RESERVED || booking.reservationPaid) {
          console.log('[Verification] ✅ Reservation already paid, skipping');
          return;
        }
      } else if (isRemainingPayment) {
        // This is remaining payment after reservation
        expectedAmount = booking.remainingAmount!;
        paymentToken = booking.remainingToken || booking.paymentToken || 'USDC';
        
        console.log(`[Verification] 💰 REMAINING Payment: $${expectedAmount} ${paymentToken}`);
        
        if (!booking.reservationPaid) {
          throw new Error('Cannot verify remaining payment - reservation not paid yet');
        }
        
        if (booking.status === BookingStatus.CONFIRMED || booking.remainingPaid) {
          console.log('[Verification] ✅ Remaining payment already processed, skipping');
          return;
        }
      } else {
        // This is a full payment (no reservation)
        expectedAmount = booking.paymentAmount!;
        paymentToken = booking.paymentToken || 'USDC';
        
        console.log(`[Verification] 💰 FULL Payment: $${expectedAmount} ${paymentToken}`);
        
        if (booking.status === BookingStatus.CONFIRMED) {
          console.log('[Verification] ✅ Booking already confirmed, skipping');
          return;
        }
      }

      // 3. Verify payment details are locked
      if (!paymentToken || !expectedAmount) {
        console.error('[Verification] ❌ Payment details not locked');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Payment details not locked',
          isReservationPayment,
          isRemainingPayment,
        });
        return;
      }

      console.log(`[Verification] Expected amount: ${expectedAmount} ${paymentToken}`);

      // 4. Get blockchain client
      const publicClient = getPublicClient(chainId);
      if (!publicClient) {
        throw new Error(`No client configured for chain ${chainId}`);
      }

      // 5. Get transaction receipt
      console.log('[Verification] 🔍 Fetching transaction receipt...');
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      if (!receipt) {
        console.log(`[Verification] ⏳ Transaction not found yet, retrying in ${retryDelayMs}ms...`);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        } else {
          console.error(`[Verification] ❌ Max retries exceeded for tx ${txHash}`);
          await updateBookingStatus(bookingId, BookingStatus.FAILED, {
            error: 'Transaction timeout - not mined after retries',
            isReservationPayment,
            isRemainingPayment,
          });
          return;
        }
      }

      // 6. Check transaction status
      console.log(`[Verification] Receipt status: ${receipt.status}`);
      console.log(`[Verification] Block number: ${receipt.blockNumber}`);
      console.log(`[Verification] Total logs: ${receipt.logs.length}`);

      if (!receipt.status || receipt.status !== 'success') {
        console.error('[Verification] ❌ Transaction failed on-chain');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Transaction failed on blockchain',
          isReservationPayment,
          isRemainingPayment,
        });
        return;
      }

      // 7. Get chain and token configuration
      const chain = chainConfig[chainId];
      if (!chain) {
        throw new Error(`Chain ${chainId} not configured`);
      }

      const tokenInfo = chain.tokens[paymentToken as 'USDC' | 'USDT'];
      if (!tokenInfo) {
        throw new Error(`Token ${paymentToken} not configured for chain ${chainId}`);
      }

      console.log(`[Verification] Token: ${paymentToken}`);
      console.log(`[Verification] Token address: ${tokenInfo.address}`);
      console.log(`[Verification] Token decimals: ${tokenInfo.decimals}`);
      console.log(`[Verification] Treasury address: ${treasuryAddress}`);

      const expectedBaseUnits = parseUnits(
        expectedAmount.toString(),
        tokenInfo.decimals
      );

      console.log(`[Verification] Expected base units: ${expectedBaseUnits.toString()}`);

      // 8. Parse transfer logs
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

      const tokenAddressLower = tokenInfo.address.toLowerCase();
      const treasuryAddressLower = treasuryAddress.toLowerCase();

      console.log(`\n[Verification] 🎯 Filtering for Transfer events...`);
      console.log(`[Verification] Looking for token address: ${tokenAddressLower}`);
      console.log(`[Verification] Looking for Transfer topic: ${TRANSFER_TOPIC}`);

      const transferLogs = receipt.logs.filter((log) => {
        const addressMatch = log.address.toLowerCase() === tokenAddressLower;
        const topicMatch = log.topics[0] === TRANSFER_TOPIC;
        return addressMatch && topicMatch;
      });

      console.log(`\n[Verification] Found ${transferLogs.length} Transfer event(s) from ${paymentToken} token`);

      if (transferLogs.length === 0) {
        console.error('\n[Verification] ❌ No Transfer events found');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'No transfer events in transaction',
          chainId,
          tokenAddress: tokenInfo.address,
          txHash,
          isReservationPayment,
          isRemainingPayment,
        });
        return;
      }

      // 9. Verify transfer details
      let validTransferFound = false;
      
      for (let i = 0; i < transferLogs.length; i++) {
        const log = transferLogs[i];
        console.log(`\n[Verification] 🔍 Checking Transfer event ${i + 1}/${transferLogs.length}...`);
        
        const toAddress = `0x${log.topics[2]?.slice(26)}`;
        const toAddressLower = toAddress.toLowerCase();
        
        console.log(`[Verification] Transfer to: ${toAddress}`);
        console.log(`[Verification] Expected treasury: ${treasuryAddress}`);
        console.log(`[Verification] Addresses match: ${toAddressLower === treasuryAddressLower}`);
        
        if (toAddressLower === treasuryAddressLower) {
          console.log('[Verification] ✅ Found transfer to treasury!');
          
          const transferredValue = BigInt(log.data);
          console.log(`[Verification] Transferred amount (base units): ${transferredValue.toString()}`);
          console.log(`[Verification] Expected amount (base units): ${expectedBaseUnits.toString()}`);
          console.log(`[Verification] Amounts match: ${transferredValue === expectedBaseUnits}`);
          
          if (transferredValue !== expectedBaseUnits) {
            console.error(`[Verification] ❌ Amount mismatch!`);
            await updateBookingStatus(bookingId, BookingStatus.FAILED, {
              error: 'Payment amount mismatch on blockchain',
              onChain: Number(transferredValue) / 10 ** tokenInfo.decimals,
              expected: expectedAmount,
              isReservationPayment,
              isRemainingPayment,
            });
            return;
          }
          
          console.log(`[Verification] ✅ Amount verified: ${expectedAmount} ${paymentToken}`);
          validTransferFound = true;
          
          // Get transaction details for gas calculation
          console.log('[Verification] 📊 Fetching transaction details for gas calculation...');
          const tx = await publicClient.getTransaction({
            hash: txHash as `0x${string}`,
          });
          
          const gasUsed = receipt.gasUsed.toString();
          const gasPrice = tx.gasPrice || BigInt(0);
          const gasFeeWei = BigInt(gasUsed) * gasPrice;
          const gasFeeNative = Number(gasFeeWei) / 1e18;
          const nativePriceUsd = chainId === 56 ? 600 : 3000;
          const gasFeeUSD = gasFeeNative * nativePriceUsd;
          
          console.log(`[Verification] Gas fee: ${gasFeeNative.toFixed(6)} ${chain.nativeCurrency.symbol} (~$${gasFeeUSD.toFixed(4)})`);
          
          // ✅ NEW: Update booking based on payment type
          if (isReservationPayment) {
            // RESERVATION PAYMENT CONFIRMED
            console.log('[Verification] 💾 Updating booking status to RESERVED...');
            
            await db.booking.update({
              where: { bookingId },
              data: {
                status: BookingStatus.RESERVED,
                reservationPaid: true,
                reservationTxHash: txHash,
                reservationPaidAt: new Date(),
                reservationChainId: chainId,
                reservationToken: paymentToken,
                blockNumber: Number(receipt.blockNumber),
                senderAddress: tx.from,
                receiverAddress: treasuryAddress,
                gasUsed: gasUsed,
                gasFeeUSD: gasFeeUSD,
              },
            });

            // Log activity
            await db.activityLog.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                action: 'reservation_paid',
                entity: 'booking',
                entityId: booking.id,
                details: {
                  txHash,
                  chainId,
                  amount: expectedAmount,
                  token: paymentToken,
                  blockNumber: Number(receipt.blockNumber),
                  gasUsed,
                  gasFeeUSD,
                  remainingAmount: booking.remainingAmount,
                  remainingDueDate: booking.remainingDueDate,
                },
              },
            });
            
            // Send reservation confirmed email
            if (booking.user?.email && booking.stay) {
              try {
                console.log(`[Verification] 📧 Sending reservation confirmation email to ${booking.user.email}...`);
                
                await sendReservationConfirmedEmail({
                  recipientEmail: booking.user.email,
                  recipientName: booking.user.name || booking.guestName || 'Guest',
                  bookingId: booking.bookingId,
                  stayTitle: booking.stay.title,
                  stayLocation: booking.stay.location,
                  startDate: booking.stay.startDate,
                  endDate: booking.stay.endDate,
                  reservationAmount: expectedAmount,
                  reservationToken: paymentToken as 'USDC' | 'USDT',
                  remainingAmount: booking.remainingAmount!,
                  txHash: txHash,
                  chainId: chainId,
                  numberOfNights: booking.numberOfNights || 0,
                });
                
                console.log(`[Verification] ✅ Reservation confirmation email sent!`);
              } catch (emailError) {
                console.error('[Verification] ⚠️ Failed to send reservation confirmation email:', emailError);
                await db.activityLog.create({
                  data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    action: 'email_failed',
                    entity: 'booking',
                    entityId: booking.id,
                    details: {
                      error: (emailError as Error).message,
                      type: 'reservation_confirmation_email',
                    },
                  },
                });
              }
            }
            
            console.log(`\n[Verification] ✅✅✅ RESERVATION confirmed for booking ${bookingId} ✅✅✅\n`);
          } else if (isRemainingPayment) {
            // REMAINING PAYMENT CONFIRMED
            console.log('[Verification] 💾 Updating booking status to CONFIRMED...');
            
            await db.booking.update({
              where: { bookingId },
              data: {
                status: BookingStatus.CONFIRMED,
                remainingPaid: true,
                remainingTxHash: txHash,
                remainingPaidAt: new Date(),
                remainingChainId: chainId,
                remainingToken: paymentToken,
                confirmedAt: new Date(),
                totalPaid: (booking.reservationAmount || 0) + expectedAmount,
              },
            });

            // Log activity
            await db.activityLog.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                action: 'remaining_payment_confirmed',
                entity: 'booking',
                entityId: booking.id,
                details: {
                  txHash,
                  chainId,
                  amount: expectedAmount,
                  token: paymentToken,
                  blockNumber: Number(receipt.blockNumber),
                  reservationAmount: booking.reservationAmount,
                  totalPaid: (booking.reservationAmount || 0) + expectedAmount,
                },
              },
            });
            
            // Send full confirmation email
            if (booking.user?.email && booking.stay) {
              try {
                console.log(`[Verification] 📧 Sending full confirmation email to ${booking.user.email}...`);
                
                await sendConfirmationEmail({
                  recipientEmail: booking.user.email,
                  recipientName: booking.user.name || booking.guestName || 'Guest',
                  bookingId: booking.bookingId,
                  stayTitle: booking.stay.title,
                  stayLocation: booking.stay.location,
                  startDate: booking.stay.startDate,
                  endDate: booking.stay.endDate,
                  paidAmount: (booking.reservationAmount || 0) + expectedAmount,
                  paidToken: paymentToken as 'USDC' | 'USDT',
                  txHash: txHash,
                  chainId: chainId,
                });
                
                console.log(`[Verification] ✅ Full confirmation email sent!`);
              } catch (emailError) {
                console.error('[Verification] ⚠️ Failed to send confirmation email:', emailError);
              }
            }
            
            console.log(`\n[Verification] ✅✅✅ FULL BOOKING confirmed for ${bookingId} ✅✅✅\n`);
          } else {
            // FULL PAYMENT (no reservation)
            console.log('[Verification] 💾 Updating booking status to CONFIRMED...');
            
            await db.booking.update({
              where: { bookingId },
              data: {
                status: BookingStatus.CONFIRMED,
                confirmedAt: new Date(),
                blockNumber: Number(receipt.blockNumber),
                senderAddress: tx.from,
                receiverAddress: treasuryAddress,
                gasUsed: gasUsed,
                gasFeeUSD: gasFeeUSD,
                totalPaid: booking.paymentAmount,
              },
            });

            // Log activity
            await db.activityLog.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                action: 'payment_confirmed',
                entity: 'booking',
                entityId: booking.id,
                details: {
                  txHash,
                  chainId,
                  amount: booking.paymentAmount,
                  token: booking.paymentToken,
                  blockNumber: Number(receipt.blockNumber),
                  gasUsed,
                  gasFeeUSD,
                },
              },
            });
            
            // Send confirmation email
            if (booking.user?.email && booking.stay) {
              try {
                console.log(`[Verification] 📧 Sending confirmation email to ${booking.user.email}...`);
                
                await sendConfirmationEmail({
                  recipientEmail: booking.user.email,
                  recipientName: booking.user.name || booking.guestName || 'Guest',
                  bookingId: booking.bookingId,
                  stayTitle: booking.stay.title,
                  stayLocation: booking.stay.location,
                  startDate: booking.stay.startDate,
                  endDate: booking.stay.endDate,
                  paidAmount: booking.paymentAmount!,
                  paidToken: booking.paymentToken as 'USDC' | 'USDT',
                  txHash: txHash,
                  chainId: chainId,
                });
                
                console.log(`[Verification] ✅ Confirmation email sent successfully!`);
              } catch (emailError) {
                console.error('[Verification] ⚠️ Failed to send confirmation email:', emailError);
              }
            }
            
            console.log(`\n[Verification] ✅✅✅ Payment confirmed for booking ${bookingId} ✅✅✅\n`);
          }
          
          return; // Success - exit
        }
      }

      if (!validTransferFound) {
        console.error('\n[Verification] ❌ No valid transfer to treasury found');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Transfer not sent to correct treasury address',
          expectedTreasury: treasuryAddress,
          isReservationPayment,
          isRemainingPayment,
        });
        return;
      }

    } catch (error) {
      console.error(`\n[Verification] ❌ Error on attempt ${retryCount + 1}:`, error);
      retryCount++;
      if (retryCount >= maxRetries) {
        console.error(`[Verification] ❌ All ${maxRetries} attempts failed`);
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: (error as Error).message,
          attempts: retryCount,
        });
      } else {
        console.log(`[Verification] ⏳ Retrying in ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
}

/**
 * Helper to update booking status
 */
async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  details?: any
): Promise<void> {
  await db.booking.update({
    where: { bookingId },
    data: { status },
  });
  
  const booking = await db.booking.findUnique({ where: { bookingId } });
  
  if (booking) {
    await db.activityLog.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        action: `payment_${status.toLowerCase()}`,
        entity: 'booking',
        entityId: booking.id,
        details,
      },
    });
  }
}