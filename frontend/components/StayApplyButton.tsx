"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Clock, Loader2, AlertCircle } from "lucide-react";

interface BookingStatusData {
  hasBooking: boolean;
  status?: "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "REFUNDED" | "EXPIRED" | "FAILED";
  bookingId?: string;
  confirmedAt?: string;
  expiresAt?: string;
  canPay?: boolean;
}

interface StayApplyButtonProps {
  stayId: string;
  stayTitle: string;
  className?: string;
}

export default function StayApplyButton({ stayId, stayTitle, className = "" }: StayApplyButtonProps) {
  const { data: session, status: sessionStatus } = useSession();
  
  const [bookingStatus, setBookingStatus] = useState<BookingStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Fetch user's booking status for this stay
  useEffect(() => {
    async function fetchBookingStatus() {
      const linkedWallet = (session?.user as any)?.walletAddress;

      if (sessionStatus !== "authenticated" || !linkedWallet) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/stays/${stayId}/booking-status?wallet=${linkedWallet}`);
        if (response.ok) {
          const data = await response.json();
          setBookingStatus(data);
        }
      } catch (error) {
        console.error("Error fetching booking status:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (sessionStatus !== "loading") {
      fetchBookingStatus();
    }
  }, [stayId, session, sessionStatus]);

  // Countdown timer for pending payments
  useEffect(() => {
    if (bookingStatus?.status === "PENDING" && bookingStatus.expiresAt) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(bookingStatus.expiresAt!).getTime();
        const distance = expiry - now;

        if (distance < 0) {
          setTimeLeft("Expired");
          clearInterval(interval);
          setIsLoading(true);
          setTimeout(() => {
            setBookingStatus(prev => prev ? ({ ...prev, status: "EXPIRED" }) : null);
            setIsLoading(false);
          }, 1000);
        } else {
          const hours = Math.floor(distance / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [bookingStatus]);

  // Loading state
  if (isLoading && sessionStatus === "authenticated") {
    return (
      <div className={className}>
        <button
          disabled
          className="w-full bg-white/10 text-white text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3"
        >
          <Loader2 className="animate-spin" size={20} />
          <span>Checking status...</span>
        </button>
      </div>
    );
  }

  // User not authenticated
  if (sessionStatus === "unauthenticated") {
    return (
      <div className={className}>
        <Link
          href="/auth/signin"
          className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl hover:shadow-2xl"
        >
          <span>Sign In to Apply</span>
          <ArrowRight size={24} />
        </Link>
      </div>
    );
  }

  // User has no wallet linked
  const sessionWallet = (session?.user as any)?.walletAddress;
  if (sessionStatus === "authenticated" && !sessionWallet) {
    return (
      <div className={className}>
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">💳</div>
          <p className="text-white/80 text-sm">Connect your wallet to apply</p>
        </div>
        <Link
          href="/dashboard"
          className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
        >
          <span>Connect Wallet</span>
          <ArrowRight size={24} />
        </Link>
      </div>
    );
  }

  // User has a booking - show status-specific UI
  if (bookingStatus?.hasBooking) {
    const { status, bookingId, expiresAt, canPay } = bookingStatus;

    // CONFIRMED
    if (status === "CONFIRMED") {
      return (
        <div className={className}>
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">✅</div>
            <p className="text-white text-lg font-semibold">You're All Set!</p>
          </div>
          <Link
            href="/dashboard"
            className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
          >
            <span>View Dashboard</span>
            <ArrowRight size={24} />
          </Link>
        </div>
      );
    }

    // PENDING PAYMENT
    if (status === "PENDING") {
      const isExpired = expiresAt && new Date(expiresAt) < new Date();
      
      if (isExpired) {
        return (
          <div className={className}>
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">⏰</div>
              <p className="text-white text-lg font-semibold">Payment Expired</p>
            </div>
            <Link
              href={`/stay/${stayId}/apply`}
              className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
            >
              <span>Try Again</span>
              <ArrowRight size={24} />
            </Link>
          </div>
        );
      }

      return (
        <div className={className}>
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">💳</div>
            <p className="text-white text-lg font-semibold">Complete Payment</p>
            {timeLeft && (
              <p className="text-white/70 text-sm mt-2 font-mono">
                Time left: <strong>{timeLeft}</strong>
              </p>
            )}
          </div>
          {canPay && bookingId ? (
            <Link
              href={`/booking/${bookingId}`}
              className="w-full bg-[#10b981] text-white text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl animate-pulse"
            >
              <span>Pay Now</span>
              <ArrowRight size={24} />
            </Link>
          ) : (
            <Link
              href={`/stay/${stayId}/apply`}
              className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
            >
              <span>Restart Application</span>
              <ArrowRight size={24} />
            </Link>
          )}
        </div>
      );
    }

    // WAITLISTED / UNDER REVIEW
    if (status === "WAITLISTED") {
      return (
        <div className={className}>
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">⏳</div>
            <p className="text-white text-lg font-semibold">Under Review</p>
            <p className="text-white/70 text-sm mt-1">We'll notify you soon!</p>
          </div>
          <Link
            href="/dashboard"
            className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
          >
            <span>Check Dashboard</span>
            <ArrowRight size={24} />
          </Link>
        </div>
      );
    }

    // CANCELLED / REFUNDED
    if (status === "CANCELLED" || status === "REFUNDED") {
      return (
        <div className={className}>
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">❌</div>
            <p className="text-white text-lg font-semibold">
              {status === "CANCELLED" ? "Booking Cancelled" : "Payment Refunded"}
            </p>
          </div>
          <Link
            href={`/stay/${stayId}/apply`}
            className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
          >
            <span>Apply Again</span>
            <ArrowRight size={24} />
          </Link>
        </div>
      );
    }

    // FAILED
    if (status === "FAILED" || status === "EXPIRED") {
      return (
        <div className={className}>
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">⚠️</div>
            <p className="text-white text-lg font-semibold">Payment Failed</p>
          </div>
          <Link
            href={`/stay/${stayId}/apply`}
            className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
          >
            <span>Try Again</span>
            <ArrowRight size={24} />
          </Link>
        </div>
      );
    }

    // DEFAULT / UNKNOWN STATUS
    return (
      <div className={className}>
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">📋</div>
          <p className="text-white text-sm">Status: {status}</p>
        </div>
        <Link
          href="/dashboard"
          className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
        >
          <span>View Dashboard</span>
          <ArrowRight size={24} />
        </Link>
      </div>
    );
  }

  // User authenticated, has wallet, but no booking - show apply button
  return (
    <div className={className}>
      <Link
        href={`/stay/${stayId}/apply`}
        className="w-full bg-white text-[#172a46] text-xl font-bold py-5 px-12 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl hover:shadow-2xl"
      >
        <span>Apply Now</span>
        <ArrowRight size={24} />
      </Link>
    </div>
  );
}