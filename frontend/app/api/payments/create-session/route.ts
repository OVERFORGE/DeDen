// File: app/api/payments/create-session/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/database'; // Imports our MongoDB client
import { chainConfig, treasuryAddress } from '@/lib/config'; // Imports our chain/token config
import { ethers } from 'ethers';

// This is the POST handler for http://your-site.com/api/payments/create-session
export async function POST(request: Request) {
  try {
    // 1. Read the request body
    const body = await request.json();
    const { orderId, finalAmount, currency } = body;

    // 2. Basic Validation
    if (!orderId || !finalAmount || !currency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. --- Business Logic ---
    
    // We only support BSC Testnet (chainId 97) for now
    const bscConfig = chainConfig[97];
    if (!bscConfig) {
      return NextResponse.json({ error: 'BSC Testnet not configured' }, { status: 500 });
    }

    // Find the token info (address, decimals) from our config
    const tokenInfo = bscConfig.tokens[currency.toUpperCase()];
    if (!tokenInfo) {
      return NextResponse.json({ error: 'Currency not supported' }, { status: 400 });
    }

    // Calculate the raw token amount (e.g., 90.00 USDC -> 90000000)
    const amountBaseUnits = ethers.parseUnits(finalAmount, tokenInfo.decimals).toString();
    
    // Set an expiry time (e.g., 15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 4. --- Database Step ---
    // Create the payment session in our MongoDB database
    const paymentSession = await db.paymentSession.create({
      data: {
        orderId: orderId,
        status: 'pending',
        currency: currency.toUpperCase(),
        humanAmount: finalAmount,
        amountBaseUnits: amountBaseUnits,
        expiresAt: expiresAt,
        // We leave chainId and txHash blank for now
        // They will be filled by the *next* API call
      },
    });

    // 5. --- Send the Response ---
    // We send back everything the frontend needs to start the payment
    return NextResponse.json({
      paymentSessionId: paymentSession.id,
      
      // We send this so the frontend knows what to tell the user's wallet
      paymentOptions: {
        chainId: bscConfig.chainId,
        tokenAddress: tokenInfo.address,
        treasuryAddress: treasuryAddress,
        amountBaseUnits: amountBaseUnits,
        decimals: tokenInfo.decimals,
      },
      expiresAt: expiresAt,
    });

  } catch (error) {
    console.error('Error creating payment session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}