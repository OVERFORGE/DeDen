"use client";

import React, { useState, useEffect } from "react";
import { ConnectKitButton } from "connectkit";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
// --- FIX: Import from 'viem' instead of 'ethers' ---
import { parseUnits, encodeFunctionData, Abi } from "viem";

// Define the structure of our session data
interface PaymentSession {
  paymentSessionId: string;
  paymentOptions: {
    chainId: number;
    tokenAddress: `0x${string}`;
    treasuryAddress: `0x${string}`;
    amountBaseUnits: string;
    decimals: number;
  };
  expiresAt: string;
}

// Define the structure of our API error
interface ApiError {
  error: string;
}

// Define the payment status
type PaymentStatus = "idle" | "creating_session" | "pending_wallet" | "sending_tx" | "verifying" | "confirmed" | "failed";

// --- FIX: Define the ABI for the transfer function ---
const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const; // Use 'as const' for strict typing

export default function CheckoutPage() {
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  
  // This is the wagmi hook to send a transaction
  const { data: txHash, isPending: isTxPending, sendTransaction } = useSendTransaction();

  // This is the wagmi hook to wait for the tx to be confirmed
  const { isLoading: isConfirming, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // --- STAGE 1: Create Payment Session ---
  const handleCreateSession = async () => {
    setStatus("creating_session");
    setError(null);

    try {
      const response = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: `ORDER-${Date.now()}`, // Using a dynamic order ID for testing
          finalAmount: "1.5", // Paying 1.5 USDC for testing
          currency: "USDC",
        }),
      });

      if (!response.ok) {
        const err: ApiError = await response.json();
        throw new Error(err.error || "Failed to create payment session");
      }

      const session: PaymentSession = await response.json();
      setPaymentSession(session);
      setStatus("pending_wallet");

    } catch (err: any) {
      setError(err.message);
      setStatus("failed");
    }
  };

  // --- STAGE 2: Send the Transaction ---
  const handlePay = () => {
    if (!paymentSession) {
      setError("No payment session found.");
      return;
    }
    
    // Check if user is on the correct network
    const { chainId, treasuryAddress, amountBaseUnits, tokenAddress, decimals } = paymentSession.paymentOptions;
    if (connectedChainId !== chainId) {
      setError(`Please switch your wallet to BSC Testnet (Chain 97) to pay.`);
      // You can add a "switch network" button here using wagmi's `useSwitchChain` hook
      return;
    }
    
    setError(null);
    setStatus("sending_tx");

    // Use wagmi's sendTransaction hook
    // This is for a direct ERC-20 transfer
    sendTransaction({
      to: tokenAddress,
      // --- FIX: Use viem's encodeFunctionData ---
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [
          treasuryAddress,
          BigInt(amountBaseUnits) // Convert string to BigInt
        ]
      }),
    });
  };

  // --- STAGE 3: Submit TX for Verification ---
  // This useEffect triggers *after* the transaction hash is returned from wagmi
  useEffect(() => {
    if (txHash && paymentSession) {
      const submitForVerification = async () => {
        try {
          const response = await fetch("/api/payments/submit-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentSessionId: paymentSession.paymentSessionId,
              txHash: txHash,
              chainId: paymentSession.paymentOptions.chainId,
            }),
          });
  
          if (!response.ok) {
            const err: ApiError = await response.json();
            throw new Error(err.error || "Failed to submit payment");
          }

          const { status } = await response.json();
          if (status === 'pending_verification') {
            setStatus("verifying");
          } else {
            throw new Error("Failed to start verification.");
          }

        } catch (err: any) {
          setError(err.message);
          setStatus("failed");
        }
      };
      
      submitForVerification();
    }
  }, [txHash, paymentSession]);


  // --- STAGE 4: Poll for Confirmation ---
  // This useEffect runs only when our status is "verifying"
  useEffect(() => {
    if (status === "verifying" && paymentSession) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/status/${paymentSession.paymentSessionId}`);
          if (!response.ok) {
            // Stop polling if API fails
            throw new Error("Status check failed");
          }
          
          const { status: newStatus } = await response.json();
          
          if (newStatus === "confirmed") {
            setStatus("confirmed");
            clearInterval(interval);
          } else if (newStatus === "failed") {
            setStatus("failed");
            setError("Payment verification failed. Please contact support.");
            clearInterval(interval);
          }
          // If status is still "pending", do nothing and let the interval run again
          
        } catch (err: any) {
          setError(err.message);
          clearInterval(interval);
        }
      }, 3000); // Poll every 3 seconds

      // Cleanup function to stop polling if component unmounts
      return () => clearInterval(interval);
    }
  }, [status, paymentSession]);


  // --- Helper to get button text ---
  const getButtonText = () => {
    switch (status) {
      case "creating_session":
        return "Creating session...";
      case "pending_wallet":
        return "Pay Now";
      case "sending_tx":
      case "verifying":
        if (isTxPending) return "Confirm in wallet...";
        if (isConfirming) return "Sending transaction...";
        if (isTxConfirmed) return "Verifying payment...";
        return "Verifying...";
      case "confirmed":
        return "Payment Confirmed!";
      case "failed":
        return "Retry Payment";
      default:
        return "Start Payment";
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Checkout</h1>
      
      {/* Wallet Connect Button */}
      <ConnectKitButton />

      {/* Show payment button only if connected */}
      {isConnected ? (
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => {
              if (status === "idle" || status === "failed") {
                handleCreateSession();
              } else if (status === "pending_wallet") {
                handlePay();
              }
            }}
            disabled={status === "creating_session" || status === "sending_tx" || status === "verifying" || status === "confirmed"}
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
          >
            {getButtonText()}
          </button>
        </div>
      ) : (
        <p style={{ marginTop: '20px' }}>Please connect your wallet to pay.</p>
      )}

      {/* --- Status & Error Messages --- */}
      <div style={{ marginTop: '20px' }}>
        {status === "confirmed" && (
          <div style={{ color: 'green' }}>
            <strong>Success!</strong> Your payment has been confirmed.
            {txHash && <p>Transaction: {txHash}</p>}
          </div>
        )}
        {error && (
          <div style={{ color: 'red' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}

