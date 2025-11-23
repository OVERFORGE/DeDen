// File: app/booking/[bookingId]/page.tsx
// ✅ UPDATED: Added reservation and remaining payment support

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

// ✅ UPDATED: Added reservation fields
type BookingDetails = {
  bookingId: string;
  status: "PENDING" | "CONFIRMED" | "RESERVED" | "EXPIRED" | "FAILED" | "WAITLISTED";
  expiresAt: string;
  txHash: string | null;
  paymentToken: "USDC" | "USDT" | null;
  paymentAmount: number | null;
  chainId: number | null;
  selectedRoomPriceUSDC: number | null;
  selectedRoomPriceUSDT: number | null;
  
  // ✅ NEW: Reservation fields
  requiresReservation: boolean;
  reservationAmount: number | null;
  reservationPaid: boolean;
  remainingAmount: number | null;
  remainingPaid: boolean;
  numberOfNights: number | null;
  
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
  const [selectedChain, setSelectedChain] = useState<number>(42161);
  const [selectedToken, setSelectedToken] = useState<"USDC" | "USDT">("USDC");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("loading");

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

        if (data.status === "FAILED" || data.status === "EXPIRED") {
          setError(`Payment ${data.status.toLowerCase()}. Please retry.`);
          setStatus("ready");
          data.paymentToken = null;
          data.paymentAmount = null;
        }

        if (data.chainId) setSelectedChain(data.chainId);

        if (data.status === "CONFIRMED") {
          if (data.paymentToken) setSelectedToken(data.paymentToken);
          setStatus("confirmed");
        } else if (data.status === "RESERVED") {
          // ✅ NEW: Handle RESERVED status (reservation paid, awaiting remaining)
          setStatus("ready");
        } else if (data.status === "PENDING") {
          if (data.paymentToken) {
            setSelectedToken(data.paymentToken);
          } else {
            const supported = getSupportedTokens(data.chainId || selectedChain);
            if (!supported.includes(selectedToken)) {
              setSelectedToken(supported[0] as "USDC" | "USDT");
            }
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
  }, [bookingId]);

  useEffect(() => {
    if (status !== "verifying" || !bookingId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/status/${bookingId}`);
        const data = await res.json();
        if (data.status === "CONFIRMED" || data.status === "RESERVED") {
          setStatus("confirmed");
          clearInterval(interval);
        } else if (data.status === "FAILED" || data.status === "EXPIRED") {
          setStatus("ready");
          setError(`Payment ${data.status.toLowerCase()}. Please retry.`);
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
      // ✅ NEW: Determine if this is reservation or remaining payment
      const isReservationPayment = booking.requiresReservation && !booking.reservationPaid;
      const isRemainingPayment = booking.requiresReservation && booking.reservationPaid && !booking.remainingPaid;

      const amount = isReservationPayment
        ? booking.reservationAmount
        : isRemainingPayment
        ? booking.remainingAmount
        : selectedToken === "USDC"
        ? booking.selectedRoomPriceUSDC || booking.stay.priceUSDC
        : booking.selectedRoomPriceUSDT || booking.stay.priceUSDT;

      if (!amount) {
        throw new Error("Payment amount not available");
      }

      const chain = chainConfig[selectedChain];
      if (!chain) {
        throw new Error("Selected chain not supported");
      }

      const tokenInfo = chain.tokens[selectedToken];
      if (!tokenInfo) {
        throw new Error(`${selectedToken} not supported on ${chain.name}`);
      }

      if (!treasuryAddress || !/^0x[a-fA-F0-9]{40}$/i.test(treasuryAddress)) {
        throw new Error("Invalid treasury address configuration");
      }

      // Lock payment details
      console.log("Locking payment details in database...");
      const lockRes = await fetch("/api/bookings/lock-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          paymentToken: selectedToken,
          paymentAmount: amount,
          chainId: selectedChain,
        }),
      });

      if (!lockRes.ok) {
        const { error } = await lockRes.json();
        throw new Error(
          error || "Failed to lock payment details. Please refresh."
        );
      }

      setBooking((prev) =>
        prev
          ? {
              ...prev,
              paymentToken: selectedToken,
              paymentAmount: amount,
              chainId: selectedChain,
            }
          : null
      );

      if (walletChainId !== selectedChain) {
        console.log(`Switching to chain ${selectedChain}...`);
        await switchChain({ chainId: selectedChain });
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const amountBaseUnits = parseUnits(amount.toString(), tokenInfo.decimals);

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [treasuryAddress as `0x${string}`, amountBaseUnits],
      });

      const tx = await sendTransactionAsync({
        to: tokenInfo.address as `0x${string}`,
        data: data,
      });

      console.log("Transaction sent:", tx);

      // ✅ NEW: Pass isRemainingPayment flag
      setStatus("verifying");
      const res = await fetch("/api/payments/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          txHash: tx,
          chainId: selectedChain,
          paymentToken: selectedToken,
          isRemainingPayment: isRemainingPayment, // ✅ NEW
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
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-10">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

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
  }

  if (status === "confirmed") {
    // ✅ UPDATED: Show different message for reservation vs full confirmation
    const isReservationConfirmed = booking.status === "RESERVED";
    
    return (
      <div className="flex items-center justify-center py-20 bg-[#E7E4DF]">
        <div className="bg-white p-10 rounded-xl shadow-xl text-center max-w-md w-full">
          <h2 className="text-3xl font-bold text-[#102E4A] mb-2">
            {isReservationConfirmed ? "🎫 Reservation Confirmed!" : "✅ Payment Confirmed!"}
          </h2>

          <p className="text-gray-600 mb-6">
            {isReservationConfirmed ? (
              <>
                Your <strong className="font-semibold text-[#102E4A]">${booking.reservationAmount}</strong> reservation 
                for <strong className="font-semibold text-[#102E4A]">{booking.stay.title}</strong> is confirmed!
                <br /><br />
                <span className="text-amber-700">
                  💰 Remaining payment of <strong>${booking.remainingAmount}</strong> is due on your check-in day.
                </span>
              </>
            ) : (
              <>
                Your spot for{" "}
                <strong className="font-semibold text-[#102E4A]">
                  {booking.stay.title}
                </strong>{" "}
                is confirmed.
              </>
            )}
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
            className="block mt-6 bg-[#102E4A] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#102E4A]/80 transition duration-150"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ✅ NEW: Determine payment type and calculate display amount
  const isReservationPayment = booking.requiresReservation && !booking.reservationPaid;
  const isRemainingPayment = booking.requiresReservation && booking.reservationPaid && !booking.remainingPaid;

  const displayAmount = isReservationPayment
    ? booking.reservationAmount
    : isRemainingPayment
    ? booking.remainingAmount
    : selectedToken === "USDC"
    ? booking.selectedRoomPriceUSDC || booking.stay.priceUSDC
    : booking.selectedRoomPriceUSDT || booking.stay.priceUSDT;

  const isPaymentLocked = !!booking.paymentToken;
  const supportedTokens = getSupportedTokens(selectedChain);
  const isWrongNetwork = walletChainId !== selectedChain;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(Number(displayAmount));

  return (
    <div className="font-sans max-w-xl mx-auto mb-20">
      <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 mx-6">
        <h2 className="text-3xl font-extrabold text-[#172a46] text-center mb-2">
          {isReservationPayment ? "🎫 Pay Reservation" : isRemainingPayment ? "💰 Pay Remaining Amount" : "Complete Your Payment"}
        </h2>
        <p className="text-lg text-gray-600 mb-10 text-center">
          Booking for{" "}
          <strong className="font-semibold">{booking.stay.title}</strong>
        </p>

        {/* ✅ NEW: Reservation info banner */}
        {booking.requiresReservation && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-blue-900 mb-2">
              📋 Two-Step Payment Required
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              Your {booking.numberOfNights}-night booking requires:
            </p>
            <div className="space-y-2 text-sm">
              <div className={`flex justify-between p-2 rounded ${!booking.reservationPaid ? 'bg-white border-2 border-blue-400' : 'bg-green-50'}`}>
                <span>1. Reservation Payment</span>
                <span className="font-bold">
                  {booking.reservationPaid ? '✅ Paid' : `$${booking.reservationAmount} (Now)`}
                </span>
              </div>
              <div className={`flex justify-between p-2 rounded ${booking.reservationPaid && !booking.remainingPaid ? 'bg-white border-2 border-blue-400' : 'bg-gray-50'}`}>
                <span>2. Remaining Payment</span>
                <span className="font-bold">
                  ${booking.remainingAmount} (Check-in)
                </span>
              </div>
            </div>
          </div>
        )}

        {booking.expiresAt && (
          <div className="p-3 bg-[#172a46]/80 border border-[#172a46] text-white text-sm rounded-lg mb-10 text-center">
            Payment expires:{" "}
            <strong className="font-semibold">
              {new Date(booking.expiresAt).toLocaleString()}
            </strong>
          </div>
        )}

        <div className="px-4 py-4 bg-blue-50 rounded-lg text-xs border border-bg-[#172a46] mb-10">
          <div className="text-[#172a46] font-semibold mb-2 text-md">
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
                className={`p-3 rounded-xl border-2 font-medium text-sm transition duration-150
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
                className={`p-3 rounded-xl border-2 font-medium text-sm transition duration-150
                  ${
                    selectedToken === token
                      ? "border-[#172a46] bg-blue-50 text-[#172a46] shadow-sm"
                      : "border-gray-200 bg-white text-gray-800 hover:border-gray-400"
                  }
                  ${
                    isPaymentLocked && selectedToken !== token
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
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

        <div className="text-center bg-blue-50 rounded-xl mb-6 border border-blue-200 py-4">
          <div className="font-berlin text-md text-[#172a46] uppercase tracking-widest mb-1">
            {isReservationPayment ? "Reservation Amount" : isRemainingPayment ? "Remaining Amount" : "Total Amount"}
          </div>
          <div className="text-5xl font-extrabold text-[#172a46] text-center">
            ${formattedAmount} <span className="text-3xl">{selectedToken}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            on {getChainName(selectedChain)}
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
            className={`font-berlin w-full py-4 text-xl font-semibold rounded-xl transition duration-200 shadow-lg
              ${
                status === "sending" || status === "verifying"
                  ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                  : "bg-[#172a46] text-white hover:bg-[#172a46]/80"
              }`}
          >
            {status === "sending" && "💼 Check your wallet..."}
            {status === "verifying" && "🔍 Verifying payment..."}
            {status === "ready" && (
              isReservationPayment
                ? `Pay $${displayAmount} Reservation`
                : isRemainingPayment
                ? `Pay $${displayAmount} Remaining`
                : `Pay $${displayAmount} ${selectedToken}`
            )}
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