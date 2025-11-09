"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccount, useSendTransaction } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import { ConnectKitButton } from "connectkit";
import { erc20Abi } from "@/lib/erc20abi";
import { chainConfig, treasuryAddress } from "@/lib/config";

// Define the shape of the booking data we fetch
type BookingDetails = {
  bookingId: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "FAILED" | "WAITLISTED";
  expiresAt: string;
  txHash: string | null;
  // ✅ Add payment fields from booking
  paymentToken: "USDC" | "USDT" | null;
  paymentAmount: number | null;
  chainId: number | null;
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
  const { data: txHash, sendTransactionAsync } = useSendTransaction();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [paymentToken, setPaymentToken] = useState<"USDC" | "USDT">("USDC");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("loading");

  // Fetch booking details on load
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

        // ✅ Set payment token from booking if available
        if (data.paymentToken) {
          setPaymentToken(data.paymentToken);
        }

        // Set initial status based on fetched data
        if (data.status === "CONFIRMED") {
          setStatus("confirmed");
        } else if (data.status === "PENDING") {
          // ✅ Check if payment details are configured
          if (!data.paymentToken || !data.paymentAmount) {
            setError("Payment details are not configured for this booking. Please contact support.");
            setStatus("error");
          } else {
            setStatus("ready");
          }
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

  // Poll for status updates after submitting
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
          setError(`Payment ${data.status.toLowerCase()}`);
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
      // ✅ Use booking's payment amount instead of stay prices
      if (!booking.paymentAmount || !booking.paymentToken) {
        throw new Error("Payment details are not configured for this booking");
      }

      const amount = booking.paymentAmount;
      const token = booking.paymentToken;
      
      // Use booking's chainId or default to BSC Testnet
      const targetChainId = booking.chainId || 97;
      const bscConfig = chainConfig[targetChainId];
      
      if (!bscConfig) {
        throw new Error("Chain configuration not found");
      }
      
      const tokenInfo = bscConfig.tokens[token];

      if (!tokenInfo) {
        throw new Error(`Token ${token} not supported on this chain`);
      }

      if (walletChainId !== bscConfig.chainId) {
        throw new Error(`Please switch your wallet to ${bscConfig.name} (Chain ID: ${bscConfig.chainId})`);
      }

      const amountBaseUnits = parseUnits(amount.toString(), tokenInfo.decimals);

      // 2. Send the transaction
      const tx = await sendTransactionAsync({
        to: tokenInfo.address as `0x${string}`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [treasuryAddress as `0x${string}`, amountBaseUnits],
        }),
      });

      // 3. Submit for verification
      setStatus("verifying");
      const res = await fetch("/api/payments/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          txHash: tx,
          chainId: bscConfig.chainId,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to submit transaction");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message);
      setStatus("ready");
    }
  };

  // --- Render different states ---

  if (status === "loading") {
    return <div style={styles.container}>Loading booking details...</div>;
  }

  if (status === "error") {
    return (
      <div style={styles.container}>
        <h2>Error</h2>
        <p style={styles.error}>{error || "An unknown error occurred."}</p>
      </div>
    );
  }

  if (!booking) {
    return <div style={styles.container}>Booking not found.</div>;
  }

  if (status === "confirmed" || booking.status === "CONFIRMED") {
    return (
      <div style={styles.container}>
        <h2>✅ Payment Confirmed!</h2>
        <p>
          You're all set! Your spot for <strong>{booking.stay.title}</strong> is
          confirmed.
        </p>
        {booking.txHash && (
          <p style={{ wordBreak: "break-all", fontSize: "0.9em", color: "#666" }}>
            Transaction: {booking.txHash}
          </p>
        )}
        <a href="/" style={styles.homeButton}>
          Back to Home
        </a>
      </div>
    );
  }

  // ✅ Use booking's payment amount or fallback to stay prices
  const displayAmount = booking.paymentAmount || 
    (paymentToken === "USDC" ? booking.stay.priceUSDC : booking.stay.priceUSDT);

  return (
    <div style={styles.container}>
      <h2>Confirm Your Spot</h2>
      <p>
        Pay to confirm your booking for <strong>{booking.stay.title}</strong>
      </p>

      {booking.expiresAt && (
        <p style={{ fontSize: "0.9em", color: "#666" }}>
          Payment session expires: {new Date(booking.expiresAt).toLocaleString()}
        </p>
      )}

      <div style={styles.paymentBox}>
        {/* Only show token selector if payment token is not pre-set */}
        {!booking.paymentToken ? (
          <select
            value={paymentToken}
            onChange={(e) => setPaymentToken(e.target.value as "USDC" | "USDT")}
            style={styles.select}
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
          </select>
        ) : (
          <div style={styles.tokenDisplay}>{booking.paymentToken}</div>
        )}
        <div style={styles.price}>${displayAmount}</div>
      </div>

      {!isConnected ? (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <ConnectKitButton />
        </div>
      ) : (
        <button
          onClick={handlePay}
          disabled={status === "sending" || status === "verifying"}
          style={{
            ...styles.button,
            ...(status === "sending" || status === "verifying" ? styles.buttonDisabled : {}),
          }}
        >
          {status === "sending" && "Check your wallet..."}
          {status === "verifying" && "Verifying payment..."}
          {status === "ready" && `Pay $${displayAmount} with ${booking.paymentToken || paymentToken}`}
        </button>
      )}

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

// --- Basic Styling ---
const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    maxWidth: "600px",
    margin: "40px auto",
    padding: "20px",
  },
  paymentBox: {
    display: "flex",
    border: "1px solid #ccc",
    borderRadius: "8px",
    margin: "20px 0",
    overflow: "hidden",
  },
  select: {
    padding: "15px",
    fontSize: "1.2em",
    border: "none",
    borderRight: "1px solid #ccc",
    backgroundColor: "white",
    cursor: "pointer",
  },
  tokenDisplay: {
    padding: "15px",
    fontSize: "1.2em",
    fontWeight: "600",
    borderRight: "1px solid #ccc",
    backgroundColor: "#f5f5f5",
  },
  price: {
    padding: "15px",
    fontSize: "1.5em",
    fontWeight: "bold",
    flexGrow: 1,
    textAlign: "center" as const,
  },
  error: {
    color: "#ef4444",
    fontSize: "0.9em",
    marginTop: "10px",
    padding: "12px",
    backgroundColor: "#fee",
    borderRadius: "6px",
    border: "1px solid #fcc",
  },
  button: {
    padding: "14px 20px",
    fontSize: "1.1em",
    backgroundColor: "#0070f3",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    width: "100%",
    fontWeight: "600",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    cursor: "not-allowed",
  },
  homeButton: {
    display: "inline-block",
    marginTop: "20px",
    padding: "12px 24px",
    backgroundColor: "#10b981",
    color: "white",
    textDecoration: "none",
    borderRadius: "8px",
    fontWeight: "600",
  },
} as const;