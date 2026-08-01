// File: lib/verification.ts
// ✅ UPDATED: Handles reservation and remaining payment verification with NFT minting

import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { getPublicClient } from './web3-client';
import { chainConfig, treasuryAddress } from './config';
import { parseUnits } from 'viem';
import { sendConfirmationEmail, sendReservationConfirmedEmail } from './email';
import { mintBookingNFT } from './nft-service'; // ✅ NEW: Import NFT service
import { recomputeStayAvailability, checkRangeAvailability } from './inventory';
import { issueTicketsForBooking, getTicketEmailPayload } from './ticket-service';

/** Which payment leg a verification is currently processing. */
export type PaymentLeg = 'reservation' | 'remaining' | 'full';

/**
 * Finds a prior *consumption* of this transaction hash that conflicts with
 * the leg we're about to credit.
 *
 * ⚠️ SECURITY-CRITICAL. Transaction hashes are public on-chain data, so
 * without this check anyone could take another guest's txHash for the same
 * stay/amount and use it to confirm their own booking for free — the
 * on-chain receipt validates perfectly (right token, right treasury, right
 * amount) because nothing in the receipt ties it to a specific booking.
 *
 * Two distinct conflicts are caught:
 *   1. Another booking already consumed this tx.
 *   2. THIS booking already consumed it on a *different* leg — e.g.
 *      re-submitting the $30 reservation tx as the remaining payment to get
 *      the balance credited for free.
 *
 * Re-verifying the same booking's same leg is NOT a conflict, so a retried
 * or duplicated verify call stays idempotent.
 */
export async function findConflictingTxUsage(
  txHash: string,
  currentBookingId: string,
  currentLeg: PaymentLeg
): Promise<{ bookingId: string; leg: PaymentLeg } | null> {
  const candidates = await db.booking.findMany({
    where: {
      OR: [
        { txHash: txHash, status: BookingStatus.CONFIRMED },
        { reservationTxHash: txHash, reservationPaid: true },
        { remainingTxHash: txHash, remainingPaid: true },
      ],
    },
    select: {
      bookingId: true,
      txHash: true,
      status: true,
      reservationTxHash: true,
      reservationPaid: true,
      remainingTxHash: true,
      remainingPaid: true,
    },
  });

  for (const b of candidates) {
    // Every leg this booking has already credited to this txHash.
    const usedLegs: PaymentLeg[] = [];
    if (b.reservationPaid && b.reservationTxHash === txHash) usedLegs.push('reservation');
    if (b.remainingPaid && b.remainingTxHash === txHash) usedLegs.push('remaining');
    if (b.status === BookingStatus.CONFIRMED && b.txHash === txHash) usedLegs.push('full');

    for (const leg of usedLegs) {
      const isSameBookingSameLeg = b.bookingId === currentBookingId && leg === currentLeg;
      if (!isSameBookingSameLeg) {
        return { bookingId: b.bookingId, leg };
      }
    }
  }

  return null;
}

/**
 * Back-compat boolean wrapper — true if this tx has been consumed at all.
 */
export async function checkTransactionUsed(txHash: string): Promise<boolean> {
  const used = await findConflictingTxUsage(txHash, '__none__', 'full');
  return !!used;
}

/**
 * Verify a payment transaction on the blockchain with retries
 * ✅ UPDATED: Handles both reservation and remaining payments + NFT minting
 */
export async function verifyPayment(
  bookingId: string,
  txHash: string,
  chainId: number,
  isRemainingPayment: boolean = false,
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

      // ✅ Check if this is reservation or remaining payment
      const isReservationPayment = booking.requiresReservation && !booking.reservationPaid && !isRemainingPayment;

      const currentLeg: PaymentLeg = isReservationPayment
        ? 'reservation'
        : isRemainingPayment
        ? 'remaining'
        : 'full';

      // ⚠️ REPLAY GUARD — must run before any state change. A txHash is
      // public on-chain data; without this, someone could paste another
      // guest's transaction hash for the same amount and get confirmed for
      // free. Checked here and again immediately before the write below,
      // to narrow the window if two verifications race.
      const alreadyUsed = await findConflictingTxUsage(txHash, bookingId, currentLeg);
      if (alreadyUsed) {
        console.error(
          `[Verification] ❌ REPLAY BLOCKED: tx ${txHash} already credited to booking ${alreadyUsed.bookingId} (${alreadyUsed.leg} leg)`
        );
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'This transaction has already been used for another payment',
          txHash,
          conflictingBookingId: alreadyUsed.bookingId,
          conflictingLeg: alreadyUsed.leg,
        });
        return;
      }
      
      console.log(`[Verification] Requires Reservation: ${booking.requiresReservation}`);
      console.log(`[Verification] Reservation Paid: ${booking.reservationPaid}`);
      console.log(`[Verification] Processing as ${isReservationPayment ? 'RESERVATION' : isRemainingPayment ? 'REMAINING' : 'FULL'} payment`);

      // 2. Determine expected amount based on payment type
      let expectedAmount: number;
      let paymentToken: string;
      
      if (isReservationPayment) {
        expectedAmount = booking.reservationAmount!;
        paymentToken = booking.reservationToken || booking.paymentToken || 'USDC';
        
        console.log(`[Verification] 💰 RESERVATION Payment: $${expectedAmount} ${paymentToken}`);
        
        if (booking.status === BookingStatus.RESERVED || booking.reservationPaid) {
          console.log('[Verification] ✅ Reservation already paid, skipping');
          return;
        }
      } else if (isRemainingPayment) {
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

      // ⚠️ `lock-payment` validates the chain is enabled for the stay and
      // records the locked chain as `booking.chainId` — but that restriction
      // only bites if this `chainId` (client-supplied, from verify-popup-tx)
      // is actually checked against it. Without this, a guest could lock on
      // an approved chain, then verify against a tx on a different chain
      // entirely, bypassing the stay's chain allowlist.
      if (booking.chainId && booking.chainId !== chainId) {
        console.error(
          `[Verification] ❌ CHAIN MISMATCH: locked to ${booking.chainId}, verification requested for ${chainId}`
        );
        await updateBookingStatus(bookingId, BookingStatus.FAILED, {
          error: 'This payment was not made on the chain locked for this booking',
          lockedChainId: booking.chainId,
          requestedChainId: chainId,
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

          // ⚠️ Second replay check, immediately before the write. The first
          // check ran before the (slow) RPC round-trips above; re-checking
          // here shrinks the window where two concurrent verifications of
          // the same txHash could both pass.
          const raceUsed = await findConflictingTxUsage(txHash, bookingId, currentLeg);
          if (raceUsed) {
            console.error(
              `[Verification] ❌ REPLAY BLOCKED (race): tx ${txHash} claimed by booking ${raceUsed.bookingId} (${raceUsed.leg} leg)`
            );
            await updateBookingStatus(bookingId, BookingStatus.FAILED, {
              error: 'This transaction has already been used for another payment',
              txHash,
              conflictingBookingId: raceUsed.bookingId,
              conflictingLeg: raceUsed.leg,
            });
            return;
          }

          // ⚠️ CAPACITY RE-CHECK — right before the write, for the two
          // transitions that newly claim a slot (PENDING -> RESERVED, or
          // PENDING -> CONFIRMED for non-reservation stays). `lock-payment`
          // only checked capacity before any money moved; a PENDING booking
          // holds nothing, so two guests racing for the last spot can both
          // pass that check and both send real crypto. This is the last
          // chance to catch that before double-booking a night — if it's
          // gone, the booking fails instead of silently overbooking, and the
          // guest's payment is refunded manually (a paid-but-failed booking
          // is surfaced via admin like any other FAILED verification).
          // The already-RESERVED remaining-payment leg below is exempt: it
          // occupies the same nights it already holds, so nothing new is
          // being claimed.
          if (isReservationPayment || (!isReservationPayment && !isRemainingPayment)) {
            const range = await checkRangeAvailability(
              booking.stayId,
              booking.guestCount || 1,
              booking.checkInDate ?? booking.stay.startDate,
              booking.checkOutDate ?? booking.stay.endDate,
              booking.bookingId
            );
            if (!range.ok) {
              console.error(
                `[Verification] ❌ CAPACITY LOST: stay ${booking.stayId} no longer has room for booking ${bookingId}'s ${booking.guestCount || 1} guest(s)${range.conflictNight ? ` on ${range.conflictNight}` : ''}`
              );
              await updateBookingStatus(bookingId, BookingStatus.FAILED, {
                error: 'This stay sold out while your payment was being confirmed. Your payment was received — contact support for a refund.',
                txHash,
                conflictNight: range.conflictNight,
              });
              return;
            }
          }

          // ✅ UPDATE BOOKING BASED ON PAYMENT TYPE
          if (isReservationPayment) {
            // ==========================================
            // RESERVATION PAYMENT CONFIRMED
            // ==========================================
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

            // ✅ Slot is secured the moment the reservation is paid — hold it
            // now so it isn't double-booked while the remaining payment is
            // still outstanding.
            await recomputeStayAvailability(booking.stayId);

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
                  recipientEmail: booking.guestEmail || booking.user.email,
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
            // ==========================================
            // REMAINING PAYMENT CONFIRMED (WITH NFT)
            // ==========================================
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

            // ✅ Issue real tickets (one per guest) before attempting the
            // NFT mint, so a failed/slow mint never blocks ticket issuance.
            try {
              await issueTicketsForBooking(booking.bookingId);
            } catch (ticketError) {
              console.error('[Verification] ⚠️ Ticket issuance failed:', ticketError);
            }

            // ✅ ✅ ✅ MINT NFT AFTER FULL PAYMENT ✅ ✅ ✅
            console.log('[Verification] 🎫 Starting NFT minting process...');
            try {
              const nftResult = await mintBookingNFT({
                bookingId: booking.bookingId,
                recipientAddress: tx.from,
                chainId: chainId,
                stayTitle: booking.stay.title,
                location: booking.stay.location,
                checkInDate: booking.checkInDate!,
                checkOutDate: booking.checkOutDate!,
                guestName: booking.guestName || booking.user?.name || 'Guest',
                numberOfNights: booking.numberOfNights || 0,
              });

              if (nftResult.success) {
                console.log(`[Verification] ✅ NFT minted successfully! Token ID: ${nftResult.tokenId}`);
                
                // Update booking with NFT details
                await db.booking.update({
                  where: { bookingId },
                  data: {
                    nftTokenId: nftResult.tokenId?.toString(),
                    nftContractAddress: nftResult.contractAddress,
                    nftMinted: true,
                  },
                });

                // Log NFT minting
                await db.activityLog.create({
                  data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    action: 'nft_minted',
                    entity: 'booking',
                    entityId: booking.id,
                    details: {
                      tokenId: nftResult.tokenId,
                      contractAddress: nftResult.contractAddress,
                      txHash: nftResult.txHash,
                      chainId: chainId,
                    },
                  },
                });

                console.log('[Verification] 🎉 NFT ticket successfully minted and saved!');
              } else {
                console.error(`[Verification] ⚠️ NFT minting failed: ${nftResult.error}`);
                
                // Log NFT minting failure (but don't fail the booking)
                await db.activityLog.create({
                  data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    action: 'nft_mint_failed',
                    entity: 'booking',
                    entityId: booking.id,
                    details: {
                      error: nftResult.error,
                      chainId: chainId,
                    },
                  },
                });
              }
            } catch (nftError) {
              console.error('[Verification] ⚠️ NFT minting error:', nftError);
              
              // Log error but don't fail the booking
              await db.activityLog.create({
                data: {
                  bookingId: booking.id,
                  userId: booking.userId,
                  action: 'nft_mint_error',
                  entity: 'booking',
                  entityId: booking.id,
                  details: {
                    error: (nftError as Error).message,
                    chainId: chainId,
                  },
                },
              });
            }
            // ✅ ✅ ✅ END NFT MINTING ✅ ✅ ✅
            
            // Send full confirmation email
            if (booking.user?.email && booking.stay) {
              try {
                console.log(`[Verification] 📧 Sending full confirmation email to ${booking.user.email}...`);
                
                await sendConfirmationEmail({
                  recipientEmail: booking.guestEmail || booking.user.email,
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
                  tickets: await getTicketEmailPayload(booking.bookingId),
                });

                console.log(`[Verification] ✅ Full confirmation email sent!`);
              } catch (emailError) {
                console.error('[Verification] ⚠️ Failed to send confirmation email:', emailError);
              }
            }
            
            console.log(`\n[Verification] ✅✅✅ FULL BOOKING confirmed for ${bookingId} ✅✅✅\n`);
            
          } else {
            // ==========================================
            // FULL PAYMENT - NO RESERVATION (WITH NFT)
            // ==========================================
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

            // ✅ Non-reservation stays hold the slot at full-payment confirmation.
            await recomputeStayAvailability(booking.stayId);

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

            // ✅ Issue real tickets (one per guest) before attempting the
            // NFT mint, so a failed/slow mint never blocks ticket issuance.
            try {
              await issueTicketsForBooking(booking.bookingId);
            } catch (ticketError) {
              console.error('[Verification] ⚠️ Ticket issuance failed:', ticketError);
            }

            // ✅ ✅ ✅ MINT NFT AFTER FULL PAYMENT ✅ ✅ ✅
            console.log('[Verification] 🎫 Starting NFT minting process...');
            try {
              const nftResult = await mintBookingNFT({
                bookingId: booking.bookingId,
                recipientAddress: tx.from,
                chainId: chainId,
                stayTitle: booking.stay.title,
                location: booking.stay.location,
                checkInDate: booking.checkInDate!,
                checkOutDate: booking.checkOutDate!,
                guestName: booking.guestName || booking.user?.name || 'Guest',
                numberOfNights: booking.numberOfNights || 0,
              });

              if (nftResult.success) {
                console.log(`[Verification] ✅ NFT minted successfully! Token ID: ${nftResult.tokenId}`);
                
                // Update booking with NFT details
                await db.booking.update({
                  where: { bookingId },
                  data: {
                    nftTokenId: nftResult.tokenId?.toString(),
                    nftContractAddress: nftResult.contractAddress,
                    nftMinted: true,
                  },
                });

                // Log NFT minting
                await db.activityLog.create({
                  data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    action: 'nft_minted',
                    entity: 'booking',
                    entityId: booking.id,
                    details: {
                      tokenId: nftResult.tokenId,
                      contractAddress: nftResult.contractAddress,
                      txHash: nftResult.txHash,
                      chainId: chainId,
                    },
                  },
                });

                console.log('[Verification] 🎉 NFT ticket successfully minted and saved!');
              } else {
                console.error(`[Verification] ⚠️ NFT minting failed: ${nftResult.error}`);
                
                // Log NFT minting failure
                await db.activityLog.create({
                  data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    action: 'nft_mint_failed',
                    entity: 'booking',
                    entityId: booking.id,
                    details: {
                      error: nftResult.error,
                      chainId: chainId,
                    },
                  },
                });
              }
            } catch (nftError) {
              console.error('[Verification] ⚠️ NFT minting error:', nftError);
              
              // Log error but don't fail the booking
              await db.activityLog.create({
                data: {
                  bookingId: booking.id,
                  userId: booking.userId,
                  action: 'nft_mint_error',
                  entity: 'booking',
                  entityId: booking.id,
                  details: {
                    error: (nftError as Error).message,
                    chainId: chainId,
                  },
                },
              });
            }
            // ✅ ✅ ✅ END NFT MINTING ✅ ✅ ✅
            
            // Send confirmation email
            if (booking.user?.email && booking.stay) {
              try {
                console.log(`[Verification] 📧 Sending confirmation email to ${booking.user.email}...`);
                
                await sendConfirmationEmail({
                  recipientEmail: booking.guestEmail || booking.user.email,
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
                  tickets: await getTicketEmailPayload(booking.bookingId),
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