// File: lib/verification.ts (COMPLETE WITH EMAIL)
// Enhanced verification with Base network support and email confirmation

import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { getPublicClient } from './web3-client';
import { chainConfig, treasuryAddress } from './config';
import { parseUnits } from 'viem';
import { sendConfirmationEmail } from './email'; // ✅ Import email function

/**
 * Check if a transaction hash has already been used
 */
export async function checkTransactionUsed(txHash: string): Promise<boolean> {
  const existingBooking = await db.booking.findFirst({
    where: {
      txHash: txHash,
      status: BookingStatus.CONFIRMED,
    },
  });
  
  return !!existingBooking;
}

/**
 * Verify a payment transaction on the blockchain with retries
 * ✅ FIXED: Proper Base network support, amount calculation, AND email sending
 */
export async function verifyPayment(
  bookingId: string,
  txHash: string,
  chainId: number,
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
      console.log(`========================================\n`);
      
      // 1. Get the booking details including room prices AND stay info for email
      const booking = await db.booking.findUnique({
        where: { bookingId },
        include: { 
          user: true,
          stay: true, // ✅ Include stay for email
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === BookingStatus.CONFIRMED) {
        console.log('[Verification] ✅ Booking already confirmed, skipping');
        return;
      }

      // 2. Check payment details are locked
      if (!booking.paymentToken || !booking.paymentAmount) {
        console.error('[Verification] ❌ Payment details not locked');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Payment details not locked',
        });
        return;
      }

      // 3. Verify room prices exist
      if (!booking.selectedRoomPriceUSDC || !booking.selectedRoomPriceUSDT) {
        console.error('[Verification] ❌ Room prices not set on booking');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Room prices not configured. Please contact support.',
        });
        return;
      }

      // 4. Get the expected amount based on locked token and room price
      let expectedAmount: number;
      
      if (booking.paymentToken === 'USDC') {
        expectedAmount = booking.selectedRoomPriceUSDC;
      } else if (booking.paymentToken === 'USDT') {
        expectedAmount = booking.selectedRoomPriceUSDT;
      } else {
        throw new Error(`Invalid payment token: ${booking.paymentToken}`);
      }

      console.log(`[Verification] Expected amount: ${expectedAmount} ${booking.paymentToken}`);
      console.log(`[Verification] Locked amount in DB: ${booking.paymentAmount}`);
      
      // Verify the locked amount matches the expected room price
      if (Math.abs(booking.paymentAmount - expectedAmount) > 0.01) {
        console.error(`[Verification] ❌ Amount mismatch! Expected: ${expectedAmount}, Locked: ${booking.paymentAmount}`);
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Payment amount mismatch',
          expected: expectedAmount,
          locked: booking.paymentAmount,
        });
        return;
      }

      // 5. Get blockchain client
      const publicClient = getPublicClient(chainId);
      if (!publicClient) {
        throw new Error(`No client configured for chain ${chainId}`);
      }

      // 6. Get transaction receipt
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
          });
          return;
        }
      }

      // 7. Check transaction status
      console.log(`[Verification] Receipt status: ${receipt.status}`);
      console.log(`[Verification] Block number: ${receipt.blockNumber}`);
      console.log(`[Verification] Total logs: ${receipt.logs.length}`);

      if (!receipt.status || receipt.status !== 'success') {
        console.error('[Verification] ❌ Transaction failed on-chain');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Transaction failed on blockchain',
        });
        return;
      }

      // 8. Get chain and token configuration
      const chain = chainConfig[chainId];
      if (!chain) {
        throw new Error(`Chain ${chainId} not configured`);
      }

      const tokenInfo = chain.tokens[booking.paymentToken];
      if (!tokenInfo) {
        throw new Error(`Token ${booking.paymentToken} not configured for chain ${chainId}`);
      }

      console.log(`[Verification] Token: ${booking.paymentToken}`);
      console.log(`[Verification] Token address: ${tokenInfo.address}`);
      console.log(`[Verification] Token decimals: ${tokenInfo.decimals}`);
      console.log(`[Verification] Treasury address: ${treasuryAddress}`);

      // ✅ FIX: Use parseUnits for consistent amount calculation
      const expectedBaseUnits = parseUnits(
        expectedAmount.toString(),
        tokenInfo.decimals
      );

      console.log(`[Verification] Expected base units: ${expectedBaseUnits.toString()}`);

      // 9. Parse transfer logs - ERC20 Transfer event signature
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

      console.log('\n[Verification] 🔍 Analyzing all logs...');
      receipt.logs.forEach((log, index) => {
        console.log(`\nLog ${index}:`);
        console.log(`  Address: ${log.address}`);
        console.log(`  Address (lowercase): ${log.address.toLowerCase()}`);
        console.log(`  Expected token address (lowercase): ${tokenInfo.address.toLowerCase()}`);
        console.log(`  Address matches: ${log.address.toLowerCase() === tokenInfo.address.toLowerCase()}`);
        console.log(`  Topics:`, log.topics);
        console.log(`  Topic[0]: ${log.topics[0]}`);
        console.log(`  Expected topic: ${TRANSFER_TOPIC}`);
        console.log(`  Topic matches: ${log.topics[0] === TRANSFER_TOPIC}`);
        console.log(`  Data: ${log.data}`);
        
        // Decode topics if it's a transfer event
        if (log.topics[0] === TRANSFER_TOPIC && log.topics.length >= 3) {
          const from = `0x${log.topics[1]?.slice(26)}`;
          const to = `0x${log.topics[2]?.slice(26)}`;
          const amount = BigInt(log.data);
          console.log(`  Decoded: from=${from}, to=${to}, amount=${amount.toString()}`);
        }
      });

      // ✅ More robust log filtering
      const tokenAddressLower = tokenInfo.address.toLowerCase();
      const treasuryAddressLower = treasuryAddress.toLowerCase();

      console.log(`\n[Verification] 🎯 Filtering for Transfer events...`);
      console.log(`[Verification] Looking for token address: ${tokenAddressLower}`);
      console.log(`[Verification] Looking for Transfer topic: ${TRANSFER_TOPIC}`);

      const transferLogs = receipt.logs.filter((log) => {
        const addressMatch = log.address.toLowerCase() === tokenAddressLower;
        const topicMatch = log.topics[0] === TRANSFER_TOPIC;
        const isMatch = addressMatch && topicMatch;
        
        if (addressMatch || topicMatch) {
          console.log(`[Verification] Potential match: address=${addressMatch}, topic=${topicMatch}, both=${isMatch}`);
        }
        
        return isMatch;
      });

      console.log(`\n[Verification] Found ${transferLogs.length} Transfer event(s) from ${booking.paymentToken} token`);

      if (transferLogs.length === 0) {
        console.error('\n[Verification] ❌ No Transfer events found');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'No transfer events in transaction',
          chainId,
          tokenAddress: tokenInfo.address,
          txHash,
        });
        return;
      }

      // 10. Verify transfer details
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
          
          // Decode and verify amount
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
            });
            return;
          }
          
          console.log(`[Verification] ✅ Amount verified: ${expectedAmount} ${booking.paymentToken}`);
          validTransferFound = true;
          
          // Get transaction details for gas calculation
          console.log('[Verification] 📊 Fetching transaction details for gas calculation...');
          const tx = await publicClient.getTransaction({
            hash: txHash as `0x${string}`,
          });
          
          // Calculate gas fee
          const gasUsed = receipt.gasUsed.toString();
          const gasPrice = tx.gasPrice || BigInt(0);
          const gasFeeWei = BigInt(gasUsed) * gasPrice;
          const gasFeeNative = Number(gasFeeWei) / 1e18;
          const nativePriceUsd = chainId === 56 ? 600 : 3000;
          const gasFeeUSD = gasFeeNative * nativePriceUsd;
          
          console.log(`[Verification] Gas fee: ${gasFeeNative.toFixed(6)} ${chain.nativeCurrency.symbol} (~$${gasFeeUSD.toFixed(4)})`);
          
          // Update booking to CONFIRMED
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
          
          // ✅ CRITICAL FIX: Send confirmation email
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
                paidAmount: booking.paymentAmount,
                paidToken: booking.paymentToken,
                txHash: txHash,
                chainId: chainId,
              });
              
              console.log(`[Verification] ✅ Confirmation email sent successfully!`);
            } catch (emailError) {
              console.error('[Verification] ⚠️ Failed to send confirmation email:', emailError);
              // Don't fail the verification if email fails - payment is still confirmed
              // Log the error for debugging
              await db.activityLog.create({
                data: {
                  bookingId: booking.id,
                  userId: booking.userId,
                  action: 'email_failed',
                  entity: 'booking',
                  entityId: booking.id,
                  details: {
                    error: (emailError as Error).message,
                    type: 'confirmation_email',
                  },
                },
              });
            }
          } else {
            console.warn('[Verification] ⚠️ Cannot send email - missing user email or stay info');
            if (!booking.user?.email) {
              console.warn('[Verification]   - User email is missing');
            }
            if (!booking.stay) {
              console.warn('[Verification]   - Stay info is missing');
            }
          }
          
          console.log(`\n[Verification] ✅✅✅ Payment confirmed for booking ${bookingId} ✅✅✅\n`);
          return; // Success - exit
        } else {
          console.log(`[Verification] ⏭️ Transfer not to treasury, skipping...`);
        }
      }

      if (!validTransferFound) {
        console.error('\n[Verification] ❌ No valid transfer to treasury found');
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'Transfer not sent to correct treasury address',
          expectedTreasury: treasuryAddress,
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