// File: app/booking/[bookingId]/page.tsx
// ✅ FIXED: Removed extra margins and improved spacing

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
import { 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Shield, 
  ArrowRight,
  ExternalLink,
  Loader2,
  Info,
  RefreshCw
} from "lucide-react";

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
    enabledChains: number[];
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
  
  const [allowedChains, setAllowedChains] = useState<number[]>([]);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [selectedChain, setSelectedChain] = useState<number>(42161);
  const [selectedToken, setSelectedToken] = useState<"USDC" | "USDT">("USDC");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

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

        const stayEnabledChains = data.stay.enabledChains;
        
        const filteredChains = stayEnabledChains && stayEnabledChains.length > 0
          ? SUPPORTED_CHAINS.filter(chainId => stayEnabledChains.includes(chainId))
          : SUPPORTED_CHAINS;
        
        if (filteredChains.length === 0) {
          throw new Error('No payment networks enabled for this stay. Please contact support.');
        }
        
        setAllowedChains(filteredChains);
        
        let defaultChain = filteredChains[0];
        
        if (data.chainId && filteredChains.includes(data.chainId)) {
          defaultChain = data.chainId;
        }
        
        setSelectedChain(defaultChain);

        if (data.status === "FAILED" || data.status === "EXPIRED") {
          setError(`Payment ${data.status.toLowerCase()}. Please retry.`);
          setStatus("ready");
          data.paymentToken = null;
          data.paymentAmount = null;
        }

        if (data.status === "CONFIRMED") {
          if (data.paymentToken) setSelectedToken(data.paymentToken);
          setStatus("confirmed");
        } else if (data.status === "RESERVED") {
          setStatus("ready");
        } else if (data.status === "PENDING") {
          if (data.paymentToken) {
            setSelectedToken(data.paymentToken);
          } else {
            const supported = getSupportedTokens(defaultChain);
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

  const handleSwitchNetwork = async () => {
    if (!switchChain) return;
    
    setIsSwitchingNetwork(true);
    setError(null);
    
    try {
      await switchChain({ chainId: selectedChain });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err: any) {
      setError(`Failed to switch network: ${err.message}`);
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const handlePay = async () => {
    if (!booking || !address || !isConnected) return;

    setError(null);
    setStatus("sending");

    try {
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

      setStatus("verifying");
      const res = await fetch("/api/payments/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          txHash: tx,
          chainId: selectedChain,
          paymentToken: selectedToken,
          isRemainingPayment: isRemainingPayment,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to submit transaction");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Payment failed");
      setStatus("ready");
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Payment Details</h3>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-red-100">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            Payment Error
          </h2>
          
          <p className="text-gray-600 text-center mb-8">
            {error || "An unexpected error occurred."}
          </p>
          
          
         <a   href="/dashboard"
            className="block w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all text-center"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-xl text-gray-600">Booking not found</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUCCESS STATE
  // ============================================================================
  if (status === "confirmed") {
    const isReservationConfirmed = booking.status === "RESERVED";
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-lg w-full">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">
            {isReservationConfirmed ? "🎫 Reservation Secured!" : "✅ Payment Complete!"}
          </h2>

          <div className="bg-green-50 rounded-xl p-6 mb-6">
            {isReservationConfirmed ? (
              <div className="space-y-3 text-center">
                <p className="text-gray-700">
                  Your <span className="font-bold text-green-700">${booking.reservationAmount}</span> reservation 
                  for <span className="font-bold">{booking.stay.title}</span> is confirmed!
                </p>
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-left">
                  <p className="text-sm text-amber-900">
                    💰 Remaining: ${booking.remainingAmount} due on check-in
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-700">
                Your spot for <span className="font-bold">{booking.stay.title}</span> is confirmed!
              </p>
            )}
          </div>

          {booking.txHash && (
            
           <a   href={`${chainConfig[selectedChain]?.blockExplorer}/tx/${booking.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-blue-50 text-blue-700 font-medium py-3 rounded-xl hover:bg-blue-100 transition-all mb-4"
            >
              View Transaction
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          
          <a  href="/dashboard"
            className="block w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-black transition-all text-center"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PAYMENT STATE - FULL WIDTH LAYOUT
  // ============================================================================
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
  const isWrongNetwork = isConnected && walletChainId !== selectedChain;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(displayAmount));

  return (
    // ✅ REMOVED: py-8 px-4 to eliminate top/side margins
    <div className="min-h-screen bg-#E7E4DF from-slate-50 to-slate-100">
      {/* ✅ REMOVED: max-w constraint and added full width */}
      <div className="w-full">
        
        {/* Header - ✅ Added padding only to content, not container */}
        <div className="text-center py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Complete Payment
          </h1>
          <p className="text-gray-600">
            {booking.stay.title}
          </p>
        </div>

        {/* ✅ LANDSCAPE LAYOUT: Full width with padding only inside */}
        <div className="grid lg:grid-cols-2 gap-6 px-6 pb-6">
          
          {/* LEFT COLUMN - Payment Details */}
          <div className="space-y-4">
            
            {/* Amount Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  {isReservationPayment ? "Reservation Amount" : isRemainingPayment ? "Remaining Amount" : "Total Amount"}
                </p>
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-5xl font-bold text-gray-900">${formattedAmount}</span>
                  <span className="text-2xl font-semibold text-gray-600">{selectedToken}</span>
                </div>
                <p className="text-sm text-gray-500">on {getChainName(selectedChain)}</p>
              </div>
            </div>

            {/* Expiration Timer */}
            {booking.expiresAt && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Payment Expires</p>
                    <p className="text-xs text-amber-700">
                      {new Date(booking.expiresAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reservation Progress */}
            {booking.requiresReservation && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Two-Step Payment</p>
                    <p className="text-xs text-blue-700">{booking.numberOfNights} nights</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    !booking.reservationPaid ? 'bg-white border-2 border-blue-500' : 'bg-green-50'
                  }`}>
                    <span className="text-sm font-medium">1. Reservation</span>
                    <span className="text-sm font-bold">
                      {booking.reservationPaid ? '✅ Paid' : `$${booking.reservationAmount}`}
                    </span>
                  </div>
                  
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    booking.reservationPaid && !booking.remainingPaid ? 'bg-white border-2 border-blue-500' : 'bg-gray-100'
                  }`}>
                    <span className="text-sm font-medium">2. Remaining</span>
                    <span className="text-sm font-bold">${booking.remainingAmount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
              <Shield className="w-4 h-4" />
              <span>Secure payment • Funds sent directly to treasury</span>
            </div>
          </div>

          {/* RIGHT COLUMN - Payment Controls */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 space-y-5">
            
            {/* Network Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Network
              </label>
              
              {allowedChains.length > 0 && allowedChains.length < SUPPORTED_CHAINS.length && (
                <div className="mb-3 flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-900">
                    {allowedChains.length} network{allowedChains.length !== 1 ? 's' : ''} available
                  </p>
                </div>
              )}
              
              {allowedChains.length === 0 ? (
                <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-center">
                  <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-red-900">
                    No networks enabled
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {allowedChains.map((chainId) => (
                    <button
                      key={chainId}
                      onClick={() => {
                        setSelectedChain(chainId);
                        const tokens = getSupportedTokens(chainId);
                        if (!tokens.includes(selectedToken)) {
                          setSelectedToken(tokens[0] as "USDC" | "USDT");
                        }
                      }}
                      className={`p-3 rounded-xl border-2 font-medium text-sm transition-all ${
                        selectedChain === chainId
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {getChainName(chainId)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Token Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Token
              </label>
              <div className="grid grid-cols-2 gap-3">
                {supportedTokens.map((token) => (
                  <button
                    key={token}
                    onClick={() => setSelectedToken(token as "USDC" | "USDT")}
                    disabled={isPaymentLocked && selectedToken !== token}
                    className={`p-3 rounded-xl border-2 font-bold transition-all ${
                      selectedToken === token
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    } ${
                      isPaymentLocked && selectedToken !== token
                        ? "opacity-40 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {token}
                  </button>
                ))}
              </div>
              {isPaymentLocked && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-700 mt-0.5" />
                  <p className="text-xs text-yellow-900">
                    Locked to <strong>{selectedToken}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Network Switch Button */}
            {isWrongNetwork && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-orange-900 text-sm mb-1">Wrong Network</p>
                    <p className="text-xs text-orange-800">
                      Switch to <strong>{getChainName(selectedChain)}</strong> to continue
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSwitchNetwork}
                  disabled={isSwitchingNetwork}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSwitchingNetwork ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Switching...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Switch to {getChainName(selectedChain)}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Payment Button */}
            {!isConnected ? (
              <div className="pt-2">
                <ConnectKitButton />
              </div>
            ) : (
              <button
                onClick={handlePay}
                disabled={
                  status === "sending" || 
                  status === "verifying" || 
                  !selectedToken || 
                  allowedChains.length === 0 ||
                  isWrongNetwork
                }
                className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                  status === "sending" || status === "verifying" || allowedChains.length === 0 || isWrongNetwork
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                }`}
              >
                {status === "sending" && (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Check Wallet
                  </>
                )}
                {status === "verifying" && (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                )}
                {status === "ready" && !isWrongNetwork && (
                  <>
                    {isReservationPayment
                      ? `Pay $${displayAmount} Reservation`
                      : isRemainingPayment
                      ? `Pay $${displayAmount} Remaining`
                      : `Pay $${displayAmount} ${selectedToken}`}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
                {isWrongNetwork && "Switch Network First"}
              </button>
            )}
          </div>
        </div>

        {/* Treasury Address - ✅ Added horizontal padding */}
        <details className="mx-6 mb-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <summary className="px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
            View Payment Destination
          </summary>
          <div className="px-6 py-4 bg-gray-50 border-t">
            <p className="text-xs font-semibold text-gray-600 mb-2">Treasury:</p>
            <code className="block p-2 bg-white rounded border text-xs font-mono break-all">
              {treasuryAddress}
            </code>
          </div>
        </details>

      </div>
    </div>
  );
}