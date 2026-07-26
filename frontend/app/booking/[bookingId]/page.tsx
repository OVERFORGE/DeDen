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
  RefreshCw,
  ArrowLeft,
  Check
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
  guestName: string | null;
  guestEmail: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  
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
        throw new Error(error || "Failed to lock payment details");
      }

      const txData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [treasuryAddress as `0x${string}`, parseUnits(amount.toString(), tokenInfo.decimals)],
      });

      const hash = await sendTransactionAsync({
        to: tokenInfo.address as `0x${string}`,
        data: txData,
        value: BigInt(0),
      });

      setStatus("verifying");

      const res = await fetch("/api/bookings/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          txHash: hash,
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

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#F3EDE0] flex items-center justify-center text-[#3D4331]">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-serif font-bold mb-2">Loading Payment Details</h3>
          <p className="opacity-70 font-medium">Please wait...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#F3EDE0] flex items-center justify-center p-6 text-[#3D4331]">
        <div className="bg-[#EBE1D0] p-10 rounded-[20px] shadow-sm max-w-md w-full border border-[#3D4331]/10">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-serif font-black text-center mb-4">Payment Error</h2>
          <p className="text-[#3D4331]/70 text-center mb-8 font-medium">{error || "An unexpected error occurred."}</p>
          <a href="/dashboard" className="block w-full bg-[#3D4331] text-[#F3EDE0] font-bold py-4 rounded-full transition-all text-center uppercase tracking-widest text-sm hover:opacity-90">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#F3EDE0] flex items-center justify-center text-[#3D4331]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 opacity-40 mx-auto mb-4" />
          <p className="text-xl font-serif font-bold">Booking not found</p>
        </div>
      </div>
    );
  }

  if (status === "confirmed") {
    const isReservationConfirmed = booking.status === "RESERVED";
    return (
      <div className="min-h-screen bg-[#F3EDE0] flex flex-col font-sans text-[#3D4331] selection:bg-[#3D4331] selection:text-[#F3EDE0]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10 w-full flex-1 flex flex-col">
          <div className="mb-10">
            <div className="mt-8">
              <h1 className="text-4xl md:text-5xl font-black mb-2 font-serif">Book Your Stay</h1>
              <p className="text-[#3D4331]/70 font-semibold tracking-wider uppercase text-sm">
                {booking.stay.title}
              </p>
            </div>
          </div>
          <div className="relative mb-16 max-w-4xl mx-auto w-full">
            <div className="absolute top-4 left-[15%] right-[15%] h-px bg-[#3D4331]/20 z-0" />
            <div className="flex justify-between relative z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center font-bold text-sm"><Check size={16} /></div>
                <span className="text-xs font-bold uppercase tracking-widest">Stay & Guests</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center font-bold text-sm"><Check size={16} /></div>
                <span className="text-xs font-bold uppercase tracking-widest">Payment</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center font-bold text-sm">3</div>
                <span className="text-xs font-bold uppercase tracking-widest">Confirmation</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-[#EBE1D0] p-12 rounded-[30px] shadow-sm max-w-xl w-full border border-[#3D4331]/10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-[#3D4331] rounded-full flex items-center justify-center mb-8 shadow-xl text-[#F3EDE0]">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-serif font-black mb-4">
                {isReservationConfirmed ? "Reservation Secured!" : "Payment Complete!"}
              </h2>
              <div className="bg-[#F3EDE0] rounded-2xl p-6 mb-8 w-full border border-[#3D4331]/10">
                {isReservationConfirmed ? (
                  <div className="space-y-4">
                    <p className="font-medium">
                      Your <strong className="font-black">${booking.reservationAmount}</strong> reservation 
                      for <strong className="font-black">{booking.stay.title}</strong> is confirmed!
                    </p>
                    <div className="bg-[#3D4331]/5 p-4 rounded-xl text-left border border-[#3D4331]/10">
                      <p className="text-sm font-bold">
                        ✦ Remaining: ${booking.remainingAmount} due on check-in
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="font-medium text-lg">
                    Your spot for <strong className="font-black">{booking.stay.title}</strong> is confirmed!
                  </p>
                )}
              </div>
              {booking.txHash && (
                <a href={`${chainConfig[selectedChain]?.blockExplorer}/tx/${booking.txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full bg-white text-[#3D4331] font-bold py-4 rounded-full transition-all mb-4 border border-[#3D4331]/20 hover:bg-[#F3EDE0] uppercase tracking-widest text-sm">
                  View Transaction <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <a href="/dashboard" className="block w-full bg-[#3D4331] text-[#F3EDE0] font-bold py-4 rounded-full hover:bg-black transition-all text-center uppercase tracking-widest text-sm">
                Go to Dashboard ✦
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#F3EDE0] text-[#3D4331] font-sans selection:bg-[#3D4331] selection:text-[#F3EDE0]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
        
        {/* Header */}
        <div className="mb-10">
          <button onClick={() => window.history.back()} className="flex items-center gap-3 text-sm font-semibold tracking-widest uppercase hover:opacity-70 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center">
              <ArrowLeft size={16} />
            </div>
            Live Stays <span className="opacity-50">/ Book Your Stay</span>
          </button>
          <div className="mt-8">
            <h1 className="text-4xl md:text-5xl font-black mb-2 font-serif">Book Your Stay</h1>
            <p className="text-[#3D4331]/70 font-semibold tracking-wider uppercase text-sm">
              {booking.stay.title}
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="relative mb-16 max-w-4xl">
          <div className="absolute top-4 left-[15%] right-[15%] h-px bg-[#3D4331]/20 z-0" />
          <div className="flex justify-between relative z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center font-bold text-sm"><Check size={16} /></div>
              <span className="text-xs font-bold uppercase tracking-widest">Stay & Guests</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center font-bold text-sm">2</div>
              <span className="text-xs font-bold uppercase tracking-widest">Payment</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#F3EDE0] border border-[#3D4331]/20 text-[#3D4331]/40 flex items-center justify-center font-bold text-sm">3</div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#3D4331]/40">Confirmation</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 relative">
          
          {/* Left Column */}
          <div className="flex-1 space-y-12">
            
            {/* Payment Methods Section */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-4">
                Payment Method
                <div className="h-px bg-[#3D4331]/20 flex-1" />
              </h2>
              
              <div className="bg-white rounded-[30px] p-8 shadow-sm border border-[#3D4331]/10 space-y-8">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-[#3D4331] mb-4">
                    Select Network
                  </label>
                  
                  {allowedChains.length === 0 ? (
                    <div className="p-5 bg-red-50 border border-red-100 rounded-2xl text-center">
                      <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-red-900">
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
                          className={`p-4 rounded-2xl font-bold text-sm transition-all ${
                            selectedChain === chainId
                              ? "bg-[#3D4331] text-[#F3EDE0]"
                              : "bg-[#F3EDE0] hover:bg-[#EBE1D0] text-[#3D4331]"
                          }`}
                        >
                          {getChainName(chainId)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-[#3D4331] mb-4">
                    Select Token
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {supportedTokens.map((token) => (
                      <button
                        key={token}
                        onClick={() => setSelectedToken(token as "USDC" | "USDT")}
                        disabled={isPaymentLocked && selectedToken !== token}
                        className={`p-4 rounded-2xl font-bold transition-all text-sm ${
                          selectedToken === token
                            ? "bg-[#3D4331] text-[#F3EDE0]"
                            : "bg-[#F3EDE0] hover:bg-[#EBE1D0] text-[#3D4331]"
                        } ${
                          isPaymentLocked && selectedToken !== token
                            ? "opacity-30 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                  {isPaymentLocked && (
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-3 text-center">
                      Locked to {selectedToken}
                    </p>
                  )}
                </div>

                {isWrongNetwork && (
                  <div className="bg-[#EBE1D0] border border-[#3D4331]/20 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 opacity-70 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-sm mb-1 uppercase tracking-widest">Wrong Network</p>
                        <p className="text-xs font-medium opacity-70">
                          Switch to <strong>{getChainName(selectedChain)}</strong> to continue
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSwitchNetwork}
                      disabled={isSwitchingNetwork}
                      className="w-full bg-[#3D4331] text-[#F3EDE0] font-bold py-4 rounded-full transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSwitchingNetwork ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Switching...</>
                      ) : (
                        <><RefreshCw className="w-4 h-4" /> Switch Network</>
                      )}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-800">{error}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column - Fixed Sidebar */}
          <div className="w-full lg:w-[400px]">
            <div className="sticky top-10 bg-[#EBE1D0] rounded-[30px] p-8 shadow-sm border border-[#3D4331]/10">
              <h3 className="font-serif text-2xl font-black mb-6">Overview</h3>
              
              <div className="space-y-6 text-[#3D4331]/80">
                {/* Stay Details */}
                <div className="pb-6 border-b border-[#3D4331]/10">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-[#3D4331]/60">Stay</p>
                  <p className="font-bold text-sm text-[#3D4331]">{booking.stay.title}</p>
                </div>

                {/* Guest Details */}
                {booking.guestName && (
                  <div className="pb-6 border-b border-[#3D4331]/10">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-[#3D4331]/60">Primary Guest</p>
                    <p className="font-bold text-sm text-[#3D4331]">{booking.guestName}</p>
                    {booking.guestEmail && (
                      <p className="text-xs font-medium opacity-60 mt-0.5">{booking.guestEmail}</p>
                    )}
                  </div>
                )}

                {/* Duration */}
                {booking.checkInDate && booking.checkOutDate && (
                  <div className="pb-6 border-b border-[#3D4331]/10">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-[#3D4331]/60">Duration</p>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#3D4331]">
                      <span>{new Date(booking.checkInDate).toLocaleDateString()}</span>
                      <ArrowRight className="w-3 h-3 opacity-50" />
                      <span>{new Date(booking.checkOutDate).toLocaleDateString()}</span>
                    </div>
                    {booking.numberOfNights && (
                      <p className="text-xs font-medium opacity-60 mt-1">{booking.numberOfNights} nights</p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-[#3D4331]/60">Payment Network</p>
                  <p className="font-bold text-sm bg-white/40 inline-block px-3 py-1 rounded-lg border border-[#3D4331]/5">{getChainName(selectedChain)}</p>
                </div>
                
                {booking.expiresAt && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 opacity-40 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-[#3D4331]/60">Payment Expires</p>
                      <p className="font-bold text-sm text-[#3D4331]">
                        {new Date(booking.expiresAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {booking.requiresReservation && (
                  <div className="pt-4 border-t border-[#3D4331]/10">
                    <div className="flex items-start gap-2 mb-3">
                      <Info className="w-4 h-4 opacity-40 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-[#3D4331]/60">Two-Step Payment</p>
                        <p className="text-xs font-bold">{booking.numberOfNights} nights total</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mt-3">
                      <div className={`flex items-center justify-between p-3 rounded-xl ${
                        !booking.reservationPaid ? 'bg-white shadow-sm border border-[#3D4331]/10' : 'bg-[#3D4331]/5'
                      }`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">1. Reservation</span>
                        <span className="text-sm font-bold">
                          {booking.reservationPaid ? '✅ Paid' : `$${booking.reservationAmount}`}
                        </span>
                      </div>
                      
                      <div className={`flex items-center justify-between p-3 rounded-xl ${
                        booking.reservationPaid && !booking.remainingPaid ? 'bg-white shadow-sm border border-[#3D4331]/10' : 'bg-[#3D4331]/5'
                      }`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">2. Remaining Due</span>
                        <span className="text-sm font-bold">${booking.remainingAmount}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="pt-6 mt-6 border-t border-[#3D4331]/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-serif font-bold text-lg text-[#3D4331]">
                      {isReservationPayment ? "Reservation" : isRemainingPayment ? "Remaining" : "Total"}
                    </span>
                    <span className="font-black text-4xl text-[#3D4331]">${formattedAmount}</span>
                  </div>
                  <p className="text-right text-[10px] font-black uppercase tracking-widest text-[#3D4331]/60">in {selectedToken}</p>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <div className="mt-8">
                {!isConnected ? (
                  <div className="flex justify-center">
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
                    className={`w-full py-5 rounded-full font-bold transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm shadow-xl ${
                      status === "sending" || status === "verifying" || allowedChains.length === 0 || isWrongNetwork
                        ? "bg-white text-[#3D4331]/40 cursor-not-allowed border border-[#3D4331]/10"
                        : "bg-[#3D4331] hover:bg-black text-[#F3EDE0]"
                    }`}
                  >
                    {status === "sending" && <><Loader2 className="w-5 h-5 animate-spin" /> Check Wallet</>}
                    {status === "verifying" && <><Loader2 className="w-5 h-5 animate-spin" /> Verifying</>}
                    {status === "ready" && !isWrongNetwork && (
                      <>
                        Pay ${formattedAmount} ✦
                      </>
                    )}
                    {isWrongNetwork && "Switch Network First"}
                  </button>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold opacity-60 text-center uppercase tracking-widest">
                  <Shield className="w-3 h-3" />
                  <span>Secure smart contract payment</span>
                </div>
                <details className="bg-transparent mt-2">
                  <summary className="cursor-pointer text-center text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity outline-none">
                    View Destination
                  </summary>
                  <div className="mt-2 p-3 bg-white/50 rounded-lg border border-[#3D4331]/5 text-center">
                    <code className="text-[9px] font-mono break-all font-bold opacity-70">
                      {treasuryAddress}
                    </code>
                  </div>
                </details>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}