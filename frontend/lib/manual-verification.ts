import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { chainConfig, treasuryAddress, tronTreasuryAddress } from './config';
import { verifyPayment } from './verification';
import { sendConfirmationEmail, sendReservationConfirmedEmail } from './email';
import { mintBookingNFT } from './nft-service';
import { parseUnits } from 'viem';

/**
 * Initiates the verification process for a manually submitted payment.
 */
export async function verifyManualPayment(
  bookingId: string,
  senderAddress: string,
  chainId: number,
  isRemainingPayment: boolean = false
): Promise<void> {
  try {
    console.log(`[Manual Verification] Starting scan for booking ${bookingId}, sender ${senderAddress}`);
    const booking = await db.booking.findUnique({
      where: { bookingId },
      include: { user: true, stay: true },
    });

    if (!booking) throw new Error('Booking not found');

    const isReservationPayment = booking.requiresReservation && !booking.reservationPaid && !isRemainingPayment;
    let expectedAmount: number;
    let paymentToken: string;

    if (isReservationPayment) {
      expectedAmount = booking.reservationAmount!;
      paymentToken = booking.reservationToken || booking.paymentToken || 'USDC';
    } else if (isRemainingPayment) {
      expectedAmount = booking.remainingAmount!;
      paymentToken = booking.remainingToken || booking.paymentToken || 'USDC';
    } else {
      expectedAmount = booking.paymentAmount!;
      paymentToken = booking.paymentToken || 'USDC';
    }

    if (!expectedAmount || !paymentToken) {
        throw new Error("Missing expected amount or token");
    }

    const chain = chainConfig[chainId];
    const tokenInfo = chain.tokens[paymentToken];

    if (chainId === 728126428) {
      // TRON (TRC20) Verification
      const txHash = await scanTronGrid(
        senderAddress, 
        tronTreasuryAddress, 
        expectedAmount, 
        tokenInfo.address, 
        tokenInfo.decimals,
        booking.createdAt
      );

      if (txHash) {
        console.log(`[Manual Verification] Found Tron Tx: ${txHash}`);
        await confirmTronPayment(booking, txHash, isReservationPayment, isRemainingPayment, expectedAmount, paymentToken);
      } else {
        console.log(`[Manual Verification] No Tron Tx found yet.`);
      }
    } else {
      // EVM Verification (BNB, Base, ETH)
      const txHash = await scanEVMLogs(
        chainId,
        senderAddress,
        treasuryAddress,
        expectedAmount,
        tokenInfo.address,
        tokenInfo.decimals,
        chain.rpcUrl,
        booking.createdAt
      );

      if (txHash) {
         console.log(`[Manual Verification] Found EVM Tx: ${txHash}`);
         // Delegate to existing verification logic which will validate logs and trigger confirmation
         await verifyPayment(bookingId, txHash, chainId, isRemainingPayment, 1, 1000);
      } else {
         console.log(`[Manual Verification] No EVM Tx found yet.`);
      }
    }

  } catch (error) {
    console.error('[Manual Verification] Error:', error);
  }
}

async function scanTronGrid(
    senderAddress: string,
    receiverAddress: string,
    expectedAmount: number,
    contractAddress: string,
    decimals: number,
    minTimestamp: Date
): Promise<string | null> {
    try {
        if (!receiverAddress || receiverAddress === "") return null;
        
        // TronGrid API to get TRC20 transfers for the receiver address
        const url = `https://api.trongrid.io/v1/accounts/${receiverAddress}/transactions/trc20?contract_address=${contractAddress}&limit=50`;
        
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.data || data.data.length === 0) return null;

        const expectedValue = Math.floor(expectedAmount * Math.pow(10, decimals)).toString();
        const minTimeMs = minTimestamp.getTime();

        for (const tx of data.data) {
            // Check if from sender, to receiver, exact amount, and occurred after booking was created
            if (
                tx.from.toLowerCase() === senderAddress.toLowerCase() &&
                tx.to.toLowerCase() === receiverAddress.toLowerCase() &&
                tx.value === expectedValue &&
                tx.block_timestamp >= minTimeMs
            ) {
                // Check if this tx is already used
                const used = await checkTransactionUsed(tx.transaction_id);
                if (!used) {
                    return tx.transaction_id;
                }
            }
        }
    } catch (e) {
        console.error("Tron scan error", e);
    }
    return null;
}

async function scanEVMLogs(
    chainId: number,
    senderAddress: string,
    receiverAddress: string,
    expectedAmount: number,
    contractAddress: string,
    decimals: number,
    rpcUrl: string,
    minTimestamp: Date
): Promise<string | null> {
    try {
        // Use standard JSON-RPC eth_getLogs
        const expectedBaseUnits = parseUnits(expectedAmount.toString(), decimals);
        
        const paddedSender = '0x000000000000000000000000' + senderAddress.toLowerCase().replace('0x', '');
        const paddedReceiver = '0x000000000000000000000000' + receiverAddress.toLowerCase().replace('0x', '');
        
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getLogs",
            params: [{
                address: contractAddress,
                topics: [
                    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer signature
                    paddedSender,
                    paddedReceiver
                ],
                fromBlock: "0x0", // Ideally we calculate a recent block based on minTimestamp, but this works for demo
                toBlock: "latest"
            }]
        };

        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) return null;
        
        const data = await response.json();
        if (!data.result || data.result.length === 0) return null;

        for (const log of data.result) {
            // Data field contains the amount
            const amountHex = log.data;
            const amountBigInt = BigInt(amountHex);
            
            if (amountBigInt.toString() === expectedBaseUnits.toString()) {
                const used = await checkTransactionUsed(log.transactionHash);
                if (!used) {
                    return log.transactionHash;
                }
            }
        }
    } catch (e) {
        console.error("EVM scan error", e);
    }
    return null;
}

async function checkTransactionUsed(txHash: string): Promise<boolean> {
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

// Tron specific confirmation since verifyPayment depends on viem and EVM receipts
async function confirmTronPayment(booking: any, txHash: string, isReservationPayment: boolean, isRemainingPayment: boolean, expectedAmount: number, paymentToken: string) {
    const bookingId = booking.bookingId;
    
    // Copy the confirmation logic from verifyPayment but stripped of EVM-specific stuff
    if (isReservationPayment) {
        await db.booking.update({
            where: { bookingId },
            data: {
              status: BookingStatus.RESERVED,
              reservationPaid: true,
              reservationTxHash: txHash,
              reservationPaidAt: new Date(),
              reservationChainId: 728126428,
              reservationToken: paymentToken as any,
            },
        });
        
        if (booking.user?.email && booking.stay) {
            try {
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
                chainId: 728126428,
                numberOfNights: booking.numberOfNights || 0,
              });
            } catch (e) {
                console.error(e);
            }
        }
    } else {
        await db.booking.update({
            where: { bookingId },
            data: {
              status: BookingStatus.CONFIRMED,
              txHash: txHash,
              chainId: 728126428,
              paymentToken: paymentToken as any,
              confirmedAt: new Date(),
              senderAddress: booking.senderAddress,
              receiverAddress: tronTreasuryAddress,
              totalPaid: expectedAmount,
              ...(isRemainingPayment ? {
                remainingPaid: true,
                remainingTxHash: txHash,
                remainingPaidAt: new Date(),
                remainingChainId: 728126428,
                remainingToken: paymentToken as any,
                totalPaid: (booking.reservationAmount || 0) + expectedAmount,
              } : {})
            },
        });

        if (booking.user?.email && booking.stay) {
            try {
              await sendConfirmationEmail({
                recipientEmail: booking.user.email,
                recipientName: booking.user.name || booking.guestName || 'Guest',
                bookingId: booking.bookingId,
                stayTitle: booking.stay.title,
                stayLocation: booking.stay.location,
                startDate: booking.stay.startDate,
                endDate: booking.stay.endDate,
                paidAmount: isRemainingPayment ? ((booking.reservationAmount || 0) + expectedAmount) : expectedAmount,
                paidToken: paymentToken as 'USDC' | 'USDT',
                txHash: txHash,
                chainId: 728126428,
              });
            } catch (e) {}
        }
    }
}
