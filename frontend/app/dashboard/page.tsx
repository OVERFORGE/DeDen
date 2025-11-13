"use client";

import { useState, useEffect } from "react";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SiweMessage } from "siwe";
import { useSession, signIn, signOut } from "next-auth/react";
import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import { AlertTriangle } from "lucide-react"; // Added for the new warning

type Booking = {
  bookingId: string;
  status: string;
  guestName: string;
  guestEmail: string;
  paymentAmount: number | null;
  paymentToken: string | null;
  expiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
  stay: {
    id: string;
    stayId: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    priceUSDC: number;
    priceUSDT: number;
  };
};

export default function UserDashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [debugInfo, setDebugInfo] = useState<any>(null); // Removed Debug Info
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  // Safe access to session data with null checks
  const userEmail = session?.user?.email;
  const userName = session?.user?.name;
  const linkedWallet = session?.user ? (session.user as any).walletAddress : null;
  const isWalletLinked = Boolean(linkedWallet);
  const isGoogleLinked = Boolean(userEmail);

  // Helper function to truncate wallet addresses
  const truncateAddress = (addr: string | null) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Detects if a wallet is connected, but it's not the one linked to the session
  const isWalletMismatched =
    linkedWallet &&
    isConnected &&
    address &&
    linkedWallet.toLowerCase() !== address.toLowerCase();

  useEffect(() => {
    if (sessionStatus === "loading") {
      setLoading(true);
      return;
    }

    if (!session?.user) {
      setLoading(false);
      setBookings([]);
      return;
    }

    async function fetchMyBookings() {
      try {
        setLoading(true);
        setError(null);

        // Use wallet address from session if available, otherwise use connected wallet
        const walletToUse = linkedWallet || address;

        if (!walletToUse) {
          setBookings([]);
          setLoading(false);
          return;
        }

        console.log("[Dashboard] Fetching bookings for:", walletToUse);
        const apiUrl = `/api/user/bookings?wallet=${walletToUse}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch bookings");
        }

        setBookings(data);
        /* Removed Debug Info
        setDebugInfo({
          wallet: walletToUse,
          email: userEmail,
          bookingsCount: data.length,
          timestamp: new Date().toISOString(),
        });
        */
      } catch (err: any) {
        console.error("[Dashboard] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMyBookings();
  }, [session, sessionStatus, address, linkedWallet, userEmail]);

  const handleLinkWallet = async () => {
    if (!session?.user) {
      setLinkMessage("Please sign in first");
      return;
    }

    setIsLinkingWallet(true);
    setLinkMessage(null);
    setError(null);

    try {
      // 1. Connect wallet if not connected
      let currentAddress = address;
      let currentChainId = chainId;

      if (!currentAddress) {
        await connectAsync({ connector: injected() });

        // Wait for account state to update
        let attempts = 0;
        const maxAttempts = 10;

        while ((!address || !chainId) && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          currentAddress = address;
          currentChainId = chainId;
          attempts++;
        }
      }

      if (!currentAddress) {
        throw new Error("Failed to connect wallet");
      }

      // 2. Fetch CSRF token
      const csrfRes = await fetch("/api/auth/csrf");
      if (!csrfRes.ok) throw new Error("Failed to fetch nonce");
      const { csrfToken } = await csrfRes.json();

      // 3. Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address: currentAddress,
        statement: "Link this wallet to your account",
        uri: window.location.origin,
        version: "1",
        chainId: currentChainId || 1,
        nonce: csrfToken,
      });

      const messageToSign = message.prepareMessage();

      // 4. Sign the message
      const signature = await signMessageAsync({ message: messageToSign });

      // 5. Call the link wallet API
      const linkRes = await fetch("/api/user/link-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: JSON.stringify(message),
          signature,
        }),
      });

      const linkData = await linkRes.json();

      if (!linkRes.ok) {
        throw new Error(linkData.error || "Failed to link wallet");
      }

      setLinkMessage("✅ Wallet linked successfully!");

      // Refresh session to get updated user data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error("Wallet linking error:", err);
      if (
        err.message.includes("User rejected") ||
        err.message.includes("User denied")
      ) {
        setError("Wallet linking cancelled");
      } else {
        setError(err.message || "Failed to link wallet");
      }
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (!session?.user) {
      setLinkMessage("Please sign in with wallet first");
      return;
    }

    setIsLinkingGoogle(true);
    setLinkMessage(null);
    setError(null);

    try {
      // Store current session info to merge later
      const currentUserId = session.user.id;

      // Redirect to Google OAuth with a special state parameter
      await signIn("google", {
        callbackUrl: `/dashboard?linkGoogle=true&userId=${currentUserId}`,
      });
    } catch (err: any) {
      console.error("Google linking error:", err);
      setError(err.message || "Failed to link Google account");
      setIsLinkingGoogle(false);
    }
  };

  const handleUnlinkWallet = async () => {
    if (!confirm("Are you sure you want to unlink your wallet?")) return;

    try {
      const res = await fetch("/api/user/unlink-wallet", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unlink wallet");
      }

      setLinkMessage("Wallet unlinked successfully");
      disconnect();
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (
      !confirm(
        "Are you sure you want to unlink your Google account? You'll need your wallet to sign in."
      )
    )
      return;

    try {
      const res = await fetch("/api/user/unlink-google", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unlink Google account");
      }

      setLinkMessage("Google account unlinked successfully");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusInfo = (status: string, expiresAt: string | null) => {
    const now = new Date();
    const expiry = expiresAt ? new Date(expiresAt) : null;
    const isExpired = expiry && expiry < now;

    switch (status) {
      case "WAITLISTED":
        return {
          icon: "⏳",
          label: "Under Review",
          classes: "bg-yellow-100 text-yellow-800",
          message:
            "Your application is being reviewed. We'll notify you within 24-48 hours.",
        };
      case "PENDING":
        if (isExpired) {
          return {
            icon: "⌛",
            label: "Payment Expired",
            classes: "bg-red-100 text-red-800",
            message:
              "Your payment session expired. Please contact support.",
          };
        }
        return {
          icon: "💳",
          label: "Payment Required",
          classes: "bg-blue-100 text-blue-800",
          message:
            "Your application was approved! Complete payment to confirm your spot.",
        };
      case "CONFIRMED":
        return {
          icon: "✅",
          label: "Confirmed",
          classes: "bg-green-100 text-green-800",
          message:
            "All set! Your spot is confirmed. Check your email for details.",
        };
      case "CANCELLED":
        return {
          icon: "❌",
          label: "Cancelled",
          classes: "bg-red-100 text-red-800",
          message: "This booking was cancelled.",
        };
      default:
        return {
          icon: "❓",
          label: status,
          classes: "bg-gray-100 text-gray-800",
          message: "",
        };
    }
  };

  // Loading state
  if (sessionStatus === "loading") {
    return (
      <div className="max-w-5xl mx-auto p-5 md:p-10 min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session?.user) {
    return (
      <div className="max-w-5xl mx-auto p-5 md:p-10 min-h-[80vh] flex items-center justify-center">
        <div className="text-center p-10 md:p-16 bg-white rounded-xl shadow-lg w-full max-w-md">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">
            Sign In Required
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Please sign in to view your dashboard.
          </p>
          <Link
            href="/auth/signin"
            className="block w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-5 md:p-10 min-h-screen">
      {/* Header Section */}
      <div className="mb-10">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-gray-900">
              My Dashboard
            </h1>
            <p className="text-base text-gray-500">
              {userName && `Welcome, ${userName}`}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>

        {/* Account Connections */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Google Connection Card */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border-2 border-red-200">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center gap-2">
              <span className="text-2xl">🔐</span> Google Account
            </h3>

            {isGoogleLinked ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-semibold mt-1">✅</span>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">
                      Linked Email:
                    </div>
                    <div className="bg-white px-3 py-2 rounded text-sm font-medium break-all">
                      {userEmail}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleUnlinkGoogle}
                  className="py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium w-full"
                >
                  Unlink Google
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-700 text-sm mb-3">
                  Link your Google account for easy sign-in and email
                  notifications.
                </p>
                <button
                  onClick={handleLinkGoogle}
                  disabled={isLinkingGoogle}
                  className="w-full py-2 px-4 bg-white border-2 border-red-300 text-gray-800 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
                >
                  {isLinkingGoogle ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-red-600 rounded-full animate-spin"></div>
                      Linking...
                    </>
                  ) : (
                    <>
                      <span>📧</span>
                      Link Google Account
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Wallet Connection Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center gap-2">
              <span className="text-2xl">💼</span> Wallet
            </h3>

            {isWalletLinked ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-semibold mt-1">✅</span>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">
                      Linked Wallet:
                    </div>
                    <code className="bg-white px-3 py-2 rounded text-sm font-mono block break-all">
                      {linkedWallet}
                    </code>
                  </div>
                </div>
                <button
                  onClick={handleUnlinkWallet}
                  className="py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium w-full"
                >
                  Unlink Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-700 text-sm mb-3">
                  Link your wallet to manage bookings and make crypto payments.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-[150px]">
                    <ConnectKitButton />
                  </div>
                  {isConnected && (
                    <button
                      onClick={handleLinkWallet}
                      disabled={isLinkingWallet}
                      className="flex-1 min-w-[150px] py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      {isLinkingWallet ? "Linking..." : "Link Wallet"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== ✅ NEW UPGRADED WARNING BLOCK START ===== */}
        {isWalletMismatched && (
          <div className="mb-6 p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={24} />
              Wallet Mismatch
            </h3>
            <p className="mt-3 text-gray-700 text-sm">
              The wallet currently connected in your browser does not match the
              wallet linked to this account.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">
                  Linked to Account:
                </div>
                <code className="bg-white px-3 py-2 rounded text-sm font-mono block break-all text-green-700 font-medium">
                  {truncateAddress(linkedWallet)}
                </code>
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">
                  Currently Connected:
                </div>
                <code className="bg-white px-3 py-2 rounded text-sm font-mono block break-all text-red-700 font-medium">
                  {truncateAddress(address)}
                </code>
              </div>
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-900">
              Please **switch the active wallet** in your browser (e.g.,
              MetaMask) to your linked address to proceed.
            </p>
          </div>
        )}
        {/* ===== ✅ NEW UPGRADED WARNING BLOCK END ===== */}

        {/* Status Messages */}
        {linkMessage && (
          <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 text-green-800 rounded-lg">
            {linkMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Debug Info Removed */}
      </div>

      {/* Bookings Section */}
      <h2 className="text-2xl font-bold mb-5 text-gray-900">My Applications</h2>

      {loading ? (
        <div className="text-center p-16 text-lg text-gray-600">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-5"></div>
          <p>Loading your applications...</p>
        </div>
      ) : !linkedWallet && !isConnected ? (
        <div className="text-center p-16 bg-white rounded-xl shadow-lg">
          <div className="text-6xl mb-5">💼</div>
          <h3 className="text-2xl font-semibold mb-2 text-gray-900">
            Link Your Wallet
          </h3>
          <p className="text-gray-600 mb-6">
            Connect and link your wallet to view your applications and bookings.
          </p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center p-16 bg-white rounded-xl shadow-lg">
          <div className="text-6xl mb-5">📋</div>
          <h3 className="text-2xl font-semibold mb-2 text-gray-900">
            No Applications Yet
          </h3>
          <p className="text-gray-600 mb-6">
            You haven't applied to any stays yet.
          </p>
          <Link
            href="/villas"
            className="inline-block mt-5 py-3 px-8 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Browse Available Stays
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {bookings.map((booking) => {
            const statusInfo = getStatusInfo(booking.status, booking.expiresAt);
            const isExpired =
              booking.expiresAt && new Date(booking.expiresAt) < new Date();
            return (
              <div
                key={booking.bookingId}
                className="bg-white p-6 md:p-8 rounded-xl shadow-lg relative transition-all hover:shadow-xl"
              >
                <div
                  className={`inline-block py-2 px-4 rounded-full text-sm font-semibold mb-5 ${statusInfo.classes}`}
                >
                  {statusInfo.icon} {statusInfo.label}
                </div>

                <h3 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">
                  {booking.stay.title}
                </h3>
                <p className="text-lg text-gray-600 mb-1">
                  📍 {booking.stay.location}
                </p>
                <p className="text-base text-gray-500 mb-5">
                  🗓️{" "}
                  {new Date(booking.stay.startDate).toLocaleDateString()} -{" "}
                  {new Date(booking.stay.endDate).toLocaleDateString()}
                </p>

                <div className="p-4 bg-gray-50 rounded-lg mb-5 text-base text-gray-700">
                  {statusInfo.message}
                </div>

                <div className="border-t border-gray-200 pt-5 mb-5">
                  <div className="flex justify-between items-center mb-3 text-sm flex-wrap gap-2">
                    <span className="text-gray-500">Application ID:</span>
                    <code className="text-gray-900 font-semibold font-mono">
                      {booking.bookingId}
                    </code>
                  </div>
                  <div className="flex justify-between items-center mb-3 text-sm flex-wrap gap-2">
                    <span className="text-gray-500">Applied on:</span>
                    <span className="text-gray-900 font-semibold">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {booking.paymentAmount && (
                    <div className="flex justify-between items-center mb-3 text-sm flex-wrap gap-2">
                      <span className="text-gray-500">Amount:</span>
                      <span className="text-gray-900 font-semibold">
                        ${booking.paymentAmount} {booking.paymentToken}
                      </span>
                    </div>
                  )}
                </div>

                {booking.status === "PENDING" && !isExpired && (
                  <Link
                    href={`/booking/${booking.bookingId}`}
                    className="block w-full py-3 px-5 bg-blue-600 text-white text-center rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
                  >
                    💳 Complete Payment
                  </Link>
                )}

                {booking.status === "CONFIRMED" && (
                  <Link
                    href={`/booking/${booking.bookingId}/details`}
                    className="block w-full py-3 px-5 bg-green-600 text-white text-center rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
                  >
                    View Booking Details
                  </Link>
                )}

                {booking.status === "WAITLISTED" && (
                  <Link
                    href={`/stay/${booking.stay.stayId}`}
                    className="block w-full py-3 px-5 bg-gray-600 text-white text-center rounded-lg font-semibold text-lg hover:bg-gray-700 transition-colors"
                  >
                    View Stay Details
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}