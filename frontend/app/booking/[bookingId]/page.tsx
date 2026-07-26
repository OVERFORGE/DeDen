"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { parseUnits, encodeFunctionData } from "viem";
import { erc20Abi } from "@/lib/erc20abi";
import {
  chainConfig,
  treasuryAddress,
  tronTreasuryAddress,
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
  Check,
  Copy
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

  const [allowedChains, setAllowedChains] = useState<number[]>([]);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [selectedChain, setSelectedChain] = useState<number>(1);
  const [selectedToken, setSelectedToken] = useState<"USDC" | "USDT">("USDC");
  const [senderAddress, setSenderAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [copied, setCopied] = useState(false);

  // Web3 hooks
  const { address, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

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
          if (data.paymentToken) setSelectedToken(data.paymentToken as "USDC" | "USDT");
          setStatus("confirmed");
        } else if (data.status === "RESERVED") {
          setStatus("ready");
        } else if (data.status === "PENDING") {
          if (data.paymentToken) {
            setSelectedToken(data.paymentToken as "USDC" | "USDT");
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
    }, 10000); // Polling every 10 seconds

    return () => clearInterval(interval);
  }, [status, bookingId]);

  const handlePay = async () => {
    if (!booking) return;

    if (selectedChain === 728126428 && !senderAddress) return;

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
      
      const currentTreasury = selectedChain === 728126428 ? tronTreasuryAddress : treasuryAddress;

      if (!currentTreasury || currentTreasury.includes('PLACEHOLDER') || currentTreasury.trim() === "") {
        throw new Error("Treasury address is not configured for this network");
      }

      // First lock the payment details
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

      if (selectedChain === 728126428) {
        // TRC20 Manual Flow
        const verifyRes = await fetch("/api/bookings/verify-incoming", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.bookingId,
            senderAddress: senderAddress,
            chainId: selectedChain,
            paymentToken: selectedToken,
            isRemainingPayment: isRemainingPayment
          }),
        });

        if (!verifyRes.ok) {
          const { error } = await verifyRes.json();
          throw new Error(error || "Failed to initiate verification");
        }
      } else {
        // EVM Wagmi Flow
        if (!address) {
          throw new Error("Please connect your wallet first");
        }
        
        await switchChainAsync({ chainId: selectedChain });

        const amountBaseUnits = parseUnits(amount.toString(), tokenInfo.decimals);
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [treasuryAddress as `0x${string}`, amountBaseUnits],
        });

        const txHash = await sendTransactionAsync({
          to: tokenInfo.address as `0x${string}`,
          data,
          value: BigInt(0),
        });

        const verifyRes = await fetch("/api/bookings/verify-popup-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.bookingId,
            txHash: txHash,
            chainId: selectedChain,
            isRemainingPayment: isRemainingPayment
          }),
        });

        if (!verifyRes.ok) {
          const { error } = await verifyRes.json();
          throw new Error(error || "Failed to initiate tx verification");
        }
      }

      setStatus("verifying");
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Payment failed");
      setStatus("ready");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
  
  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-[#F3EDE0] flex flex-col font-sans text-[#3D4331] selection:bg-[#3D4331] selection:text-[#F3EDE0]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10 w-full flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-[#EBE1D0] p-12 rounded-[30px] shadow-sm max-w-xl w-full border border-[#3D4331]/10 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-[#3D4331]/10 rounded-full flex items-center justify-center mb-8 shadow-xl text-[#3D4331]">
                <Loader2 className="w-12 h-12 animate-spin" />
              </div>
              <h2 className="text-3xl font-serif font-black mb-4">
                Verifying Payment
              </h2>
              <p className="font-medium text-lg mb-8 opacity-70">
                Scanning the blockchain for your transaction...
                {selectedChain === 1 && " This can take up to 10-15 minutes on Ethereum."}
              </p>
              <div className="bg-[#F3EDE0] rounded-2xl p-6 mb-8 w-full border border-[#3D4331]/10 text-sm font-bold text-left">
                <p className="opacity-60 text-xs mb-1 uppercase tracking-widest">Awaiting transfer from:</p>
                <p className="truncate mb-4">{senderAddress}</p>
                
                <p className="opacity-60 text-xs mb-1 uppercase tracking-widest">Network:</p>
                <p className="mb-4">{getChainName(selectedChain)}</p>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-50">
                You can leave this page. We'll email you once confirmed.
              </p>
            </div>
          </div>
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
              {booking.txHash && selectedChain !== 728126428 && (
                <a href={`${chainConfig[selectedChain]?.blockExplorer}/tx/${booking.txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full bg-white text-[#3D4331] font-bold py-4 rounded-full transition-all mb-4 border border-[#3D4331]/20 hover:bg-[#F3EDE0] uppercase tracking-widest text-sm">
                  View Transaction <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {booking.txHash && selectedChain === 728126428 && (
                <a href={`https://tronscan.org/#/transaction/${booking.txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full bg-white text-[#3D4331] font-bold py-4 rounded-full transition-all mb-4 border border-[#3D4331]/20 hover:bg-[#F3EDE0] uppercase tracking-widest text-sm">
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

  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(displayAmount));
  
  const currentTreasury = selectedChain === 728126428 ? tronTreasuryAddress : treasuryAddress;

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
                </div>
                
                {selectedChain === 728126428 && (
                  <>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-[#3D4331] mb-4">
                        Your Wallet Address
                      </label>
                      <input
                        type="text"
                        value={senderAddress}
                        onChange={(e) => setSenderAddress(e.target.value)}
                        placeholder="Enter the address you are sending from..."
                        className="w-full bg-[#F3EDE0] border border-[#3D4331]/20 rounded-2xl p-4 text-sm font-bold text-[#3D4331] outline-none focus:border-[#3D4331] transition-all"
                      />
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-3 flex items-center gap-1">
                        <Info size={12}/> Must match exactly where you send from.
                      </p>
                    </div>
                    
                    <div className="bg-[#EBE1D0] p-6 rounded-2xl border border-[#3D4331]/20">
                      <label className="block text-xs font-black uppercase tracking-widest text-[#3D4331] mb-2">
                        Send Exactly {formattedAmount} {selectedToken} to:
                      </label>
                      
                      {currentTreasury ? (
                        <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-inner border border-[#3D4331]/10">
                          <span className="font-mono text-sm font-bold truncate flex-1">{currentTreasury}</span>
                          <button 
                            onClick={() => copyToClipboard(currentTreasury)}
                            className="bg-[#3D4331] text-white p-2 rounded-lg hover:bg-black transition-all flex items-center justify-center shrink-0"
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-red-600 bg-red-100 p-3 rounded-xl">
                          Treasury Address missing for this network.
                        </p>
                      )}
                      
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-4 leading-relaxed">
                        Make sure to select the correct network ({getChainName(selectedChain)}) in your wallet/exchange.
                      </p>
                    </div>
                  </>
                )}

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-800">{error}</p>
                  </div>
                )}
                
                {selectedChain === 728126428 ? (
                  <button
                    onClick={handlePay}
                    disabled={status === "sending" || !senderAddress || !currentTreasury}
                    className="w-full bg-[#3D4331] text-[#F3EDE0] font-bold py-5 rounded-full transition-all flex justify-center items-center gap-3 uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {status === "sending" ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Preparing...</>
                    ) : (
                      <><Wallet className="w-5 h-5" /> I Have Sent The Payment</>
                    )}
                  </button>
                ) : (
                  <ConnectKitButton.Custom>
                    {({ isConnected, show, address: connectedAddress }) => {
                      if (!isConnected) {
                        return (
                          <button
                            onClick={show}
                            disabled={status === "sending"}
                            className="w-full bg-[#3D4331] text-[#F3EDE0] font-bold py-5 rounded-full transition-all flex justify-center items-center gap-3 uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 shadow-lg"
                          >
                            <Wallet className="w-5 h-5" /> Connect Wallet to Pay
                          </button>
                        );
                      }
                      
                      return (
                        <div className="space-y-4">
                          <div className="bg-[#EBE1D0] p-4 rounded-xl border border-[#3D4331]/20 flex justify-between items-center text-sm font-bold">
                            <span className="opacity-60 uppercase tracking-widest text-[10px]">Connected Wallet</span>
                            <span className="truncate max-w-[200px]">{connectedAddress}</span>
                          </div>
                          <button
                            onClick={handlePay}
                            disabled={status === "sending"}
                            className="w-full bg-[#3D4331] text-[#F3EDE0] font-bold py-5 rounded-full transition-all flex justify-center items-center gap-3 uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          >
                            {status === "sending" ? (
                              <><Loader2 className="w-5 h-5 animate-spin" /> Confirming in Wallet...</>
                            ) : (
                              <><CheckCircle2 className="w-5 h-5" /> Confirm Payment</>
                            )}
                          </button>
                        </div>
                      );
                    }}
                  </ConnectKitButton.Custom>
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
              </div>

              <div className="mt-8 bg-[#3D4331] text-[#F3EDE0] p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute -inset-1/2 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transform -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000 ease-in-out"></div>
                
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                  {isReservationPayment ? "Reservation Due" : isRemainingPayment ? "Remaining Due" : "Total Due"}
                </p>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="text-3xl font-black">${formattedAmount}</span>
                  <span className="text-sm font-bold opacity-70">{selectedToken}</span>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3 opacity-60">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                  Payments are secure and processed directly on-chain.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
