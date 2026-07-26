import { db } from '@/lib/database';
import { BookingStatus } from '@prisma/client';
import { chainConfig, treasuryAddress } from './config';
import { verifyPayment } from './verification';
import { parseUnits } from 'viem';

/**
 * Initiates the verification process for a manually submitted payment
 * (a sender address was registered without a captured tx hash). Scans the
 * chain for a matching Transfer log and, if found, delegates to the
 * standard verifyPayment() flow to confirm it.
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

  } catch (error) {
    console.error('[Manual Verification] Error:', error);
  }
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

