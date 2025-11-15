// File: PaymentPage.tsx (Design reverted, logic preserved)
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import { ConnectKitButton } from "connectkit";
import { erc20Abi } from "@/lib/erc20abi";
import {
  chainConfig,
  treasuryAddress,
  getSupportedTokens,
  getChainName,
  SUPPORTED_CHAINS,
} from "@/lib/config";

// --- Type Definitions (Updated) ---
type BookingDetails = {
  bookingId: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "FAILED" | "WAITLISTED";
  expiresAt: string;
  txHash: string | null;
  paymentToken: "USDC" | "USDT" | null;
  paymentAmount: number | null;
  chainId: number | null; // Fields added for room pricing
  selectedRoomPriceUSDC: number | null;
  selectedRoomPriceUSDT: number | null;
  stay: {
    title: string;
    priceUSDC: number;
    priceUSDT: number;
  };
};

type PaymentStatus =
  | "loading"
  | "ready"
  | "sending"
  | "verifying"
  | "confirmed"
  | "error";

export default function PaymentPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;

  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChain } = useSwitchChain();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [selectedChain, setSelectedChain] = useState<number>(42161); // Default Arbitrum
  const [selectedToken, setSelectedToken] = useState<"USDC" | "USDT">("USDC");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("loading"); // Fetch booking details

  useEffect(() => {
    if (!bookingId) return;

    async function fetchBooking() {
      try {
        setStatus("loading");
        setError(null);
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error || "Booking not found");
        }

        const data: BookingDetails = await res.json();
        setBooking(data);

        // Handle FAILED/EXPIRED status from initial fetch
        if (data.status === "FAILED" || data.status === "EXPIRED") {
          setError(`Payment ${data.status.toLowerCase()}. Please retry.`);
          setStatus("ready");
          // Treat payment as unlocked for retry flow on front-end
          data.paymentToken = null;
          data.paymentAmount = null;
        } // Only apply chain default on initial load

        if (data.chainId) setSelectedChain(data.chainId);

        if (data.status === "CONFIRMED") {
          // Payment is complete, use confirmed values
          if (data.paymentToken) setSelectedToken(data.paymentToken);
          setStatus("confirmed");
        } else if (data.status === "PENDING") {
          // Payment is locked ONLY if paymentToken is set in DB
          if (data.paymentToken) {
            // Payment details are locked in DB, enforce them
            setSelectedToken(data.paymentToken);
          } else {
            // Payment NOT locked yet - user is free to choose
            // Just ensure the currently selected token is supported on the selected chain
            const supported = getSupportedTokens(data.chainId || selectedChain);
            if (!supported.includes(selectedToken)) {
              // Current selection not supported on this chain, pick first available
              setSelectedToken(supported[0] as "USDC" | "USDT");
            } // Otherwise, keep user's current selection
          }
          setStatus("ready");
        } else {
          setError(`This booking is not pending. Status: ${data.status}`);
          setStatus("error");
        }
      } catch (err: any) {
        setError(err.message);
        setStatus("error");
      }
    }

    fetchBooking();
  }, [bookingId]); // Poll for status updates (CRITICAL LOGIC PRESERVED)

  useEffect(() => {
    if (status !== "verifying" || !bookingId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/status/${bookingId}`);
        const data = await res.json();
        if (data.status === "CONFIRMED") {
          setStatus("confirmed");
          clearInterval(interval);
        } else if (data.status === "FAILED" || data.status === "EXPIRED") {
          setStatus("ready");
          setError(`Payment ${data.status.toLowerCase()}. Please retry.`); // CRITICAL FIX: Unlock payment options in state after failure
          setBooking((prev) =>
            prev
              ? {
                  ...prev,
                  paymentToken: null,
                  paymentAmount: null,
                  txHash: null,
                }
              : null
          );
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, bookingId]);

  const handlePay = async () => {
    if (!booking || !address || !isConnected) return;

    setError(null);
    setStatus("sending");

    try {
      // ============================================
      // Determine the exact amount based on SELECTED token AND room price
      // This ensures we use the room-specific price if available.
      // Note: The issue with 0.01 vs 1.0 is in the backend/data layer,
      // but we ensure the front-end uses the locked/expected value if available.
      // ============================================
      const amount =
        selectedToken === "USDC"
          ? booking.selectedRoomPriceUSDC || booking.stay.priceUSDC
          : booking.selectedRoomPriceUSDT || booking.stay.priceUSDT;

      const chain = chainConfig[selectedChain];
      if (!chain) {
        throw new Error("Selected chain not supported");
      } // Check if token is supported on selected chain

      const tokenInfo = chain.tokens[selectedToken];
      if (!tokenInfo) {
        throw new Error(`${selectedToken} not supported on ${chain.name}`);
      } // Validate treasury address

      console.log("Treasury address:", treasuryAddress);
      if (
        !treasuryAddress ||
        treasuryAddress === "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error("Invalid treasury address configuration");
      } // 1. 🔒 CRITICAL STEP: Lock the selected payment details in the database

      console.log("Locking payment details in database...");
      const lockRes = await fetch("/api/bookings/lock-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          paymentToken: selectedToken,
          paymentAmount: amount, // Use the dynamically calculated amount
          chainId: selectedChain,
        }),
      });
      if (!lockRes.ok) {
        const { error } = await lockRes.json();
        throw new Error(
          error || "Failed to lock payment details. Please refresh."
        );
      }
      console.log("Payment details locked successfully."); // Optimistically update the booking state with the locked details

      setBooking((prev) =>
        prev
          ? {
              ...prev,
              paymentToken: selectedToken,
              paymentAmount: amount,
              chainId: selectedChain,
            }
          : null
      ); // Switch network if needed

      if (walletChainId !== selectedChain) {
        console.log(`Switching to chain ${selectedChain}...`);
        await switchChain({ chainId: selectedChain }); // Wait for network switch
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const amountBaseUnits = parseUnits(amount.toString(), tokenInfo.decimals);

      console.log("Payment details:", {
        token: tokenInfo.address,
        to: treasuryAddress,
        amount: amountBaseUnits.toString(),
        decimals: tokenInfo.decimals,
      }); // Encode transfer function with correct treasury address

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [treasuryAddress as `0x${string}`, amountBaseUnits],
      });

      console.log("Transaction data:", data); // Send transaction

      const tx = await sendTransactionAsync({
        to: tokenInfo.address as `0x${string}`,
        data: data,
      });

      console.log("Transaction sent:", tx); // Submit for verification

      setStatus("verifying");
      const res = await fetch("/api/payments/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          txHash: tx,
          chainId: selectedChain,
          paymentToken: selectedToken,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to submit transaction");
      }

      console.log("Transaction submitted for verification");
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Payment failed");
      setStatus("ready");
    }
  }; // Render states

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-10">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  } // Reverted design for Error state

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-xl text-center max-w-sm w-full">
          <h2 className="text-3xl font-bold text-red-600 mb-4">
            ⚠️ Payment Error
          </h2>

          <p className="text-gray-700 mb-6">
            {error || "An unknown error occurred."}
          </p>

          <a
            href="/dashboard"
            className="inline-block bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-150"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!booking) {
    return <div className="text-center p-8">Booking not found.</div>;
  } // Reverted design for Confirmed state

  if (status === "confirmed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-10 rounded-xl shadow-xl text-center max-w-md w-full">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold text-green-600 mb-2">
            Payment Confirmed!
          </h2>

          <p className="text-gray-600 mb-6">
            Your spot for{" "}
            <strong className="font-semibold text-gray-800">
              {booking.stay.title}
            </strong>{" "}
            is confirmed.
          </p>

          {booking.txHash && (
            <a
              href={`${chainConfig[selectedChain]?.blockExplorer}/tx/${booking.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 py-2 px-4 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition duration-150"
            >
              View Transaction ↗
            </a>
          )}

          <a
            href="/dashboard"
            className="block mt-6 bg-green-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-600 transition duration-150"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  } // Use the locked amount/token if available, otherwise use user selection

  const displayAmount = booking.paymentAmount
    ? booking.paymentAmount
    : // If not locked, dynamically calculate amount based on user selection AND room price
    selectedToken === "USDC"
    ? booking.selectedRoomPriceUSDC || booking.stay.priceUSDC
    : booking.selectedRoomPriceUSDT || booking.stay.priceUSDT; // If the payment details are already locked, don't allow changing the token

  const isPaymentLocked = !!booking.paymentToken;
  const supportedTokens = getSupportedTokens(selectedChain);
  const isWrongNetwork = walletChainId !== selectedChain;

  return (
    <div className="font-sans max-w-xl mx-auto  mb-20">
      <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 mx-6 ">
        <h2 className="text-3xl font-extrabold text-[#172a46] text-center mb-2">
          Complete Your Payment
        </h2>
        <p className="text-lg text-gray-600 mb-10 text-center">
          Booking for{" "}
          <strong className="font-semibold">{booking.stay.title}</strong>
        </p>
        {booking.expiresAt && (
          <div className=" p-3 bg-[#172a46]/80  border border-[#172a46] text-white  text-sm rounded-lg mb-10 text-center">
            Payment expires:
            <strong className="font-semibold">
              {new Date(booking.expiresAt).toLocaleString()}
            </strong>
          </div>
        )}
        <div className="px-4 py-4 bg-blue-50 rounded-lg  text-xs border border-bg-[#172a46] mb-10">
          <div className="text-[#172a46]  font-semibold mb-2 text-md ">
            Payment Destination:
          </div>

          <div className="font-mono text-gray-700 break-all">
            {treasuryAddress}
          </div>
        </div>
        <div className="mx-2 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            Select Network
          </label>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SUPPORTED_CHAINS.map((chainId) => (
              <button
                key={chainId}
                onClick={() => {
                  setSelectedChain(chainId);
                  const tokens = getSupportedTokens(chainId);
                  if (!tokens.includes(selectedToken)) {
                    setSelectedToken(tokens[0] as "USDC" | "USDT");
                  }
                }}
                className={`
 p-3 rounded-xl border-2 font-medium text-sm transition duration-150
 ${
   selectedChain === chainId
     ? "border-[#172a46] bg-blue-50 text-[#172a46] shadow-sm"
     : "border-gray-200 bg-white text-gray-800 hover:border-gray-400"
 }`}
              >
                {getChainName(chainId)}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-2 mb-10">
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            Select Token
          </label>
          <div className="grid grid-cols-3 gap-3">
            {supportedTokens.map((token) => (
              <button
                key={token}
                onClick={() => setSelectedToken(token as "USDC" | "USDT")}
                disabled={isPaymentLocked && selectedToken !== token}
                className={`
p-3 rounded-xl border-2 font-medium text-sm transition duration-150
${
  selectedToken === token
    ? "border-[#172a46] bg-blue-50 text-[#172a46]shadow-sm"
    : "border-gray-200 bg-white text-gray-800 hover:border-gray-400"
}
${
  isPaymentLocked && selectedToken !== token
    ? "opacity-50 cursor-not-allowed"
    : ""
}
`}
              >
                {token}
              </button>
            ))}
          </div>
          {isPaymentLocked && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm rounded-lg">
              🔒 Payment locked to{" "}
              <strong className="font-semibold">{selectedToken}</strong>.
            </div>
          )}
        </div>
        {/* Amount Display */}
        <div className="text-center  bg-blue-50 rounded-xl mb-6 border border-blue-200 py-4">
          <div className="font-berlin text-md text-[#172a46] uppercase tracking-widest mb-1">
            Total Amount
          </div>

          <div className="text-5xl font-extrabold text-[#172a46] text-center">
            ${displayAmount} <span className="text-3xl">{selectedToken}</span>
          </div>

          <div className="text-sm text-gray-500 mt-1">
            on {getChainName(selectedChain)}{" "}
          </div>
        </div>

        {isConnected && isWrongNetwork && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-800 text-sm rounded-lg mb-4 text-center">
            ⚠️ Please switch to{" "}
            <strong className="font-semibold">
              {getChainName(selectedChain)}
            </strong>{" "}
            in your wallet
          </div>
        )}

        {!isConnected ? (
          <div className="text-center mt-5">
            <ConnectKitButton />
          </div>
        ) : (
          <button
            onClick={handlePay}
            disabled={
              status === "sending" || status === "verifying" || !selectedToken
            }
            className={` font-berlin
w-full py-4 text-xl font-semibold rounded-xl transition duration-200 shadow-lg
 ${
   status === "sending" || status === "verifying"
     ? "bg-gray-400 text-gray-700 cursor-not-allowed"
     : "bg-[#172a46] text-white hover:bg-[#172a46]/80"
 }
 `}
          >
            {status === "sending" && "💼 Check your wallet..."}
            {status === "verifying" && "🔍 Verifying payment..."}

            {status === "ready" && `Pay $${displayAmount} ${selectedToken}`}
          </button>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-400 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="text-center text-xs text-gray-500 mt-4">
          🔒 Secure payment • Funds go directly to treasury address
        </div>
      </div>
    </div>
  );
}
