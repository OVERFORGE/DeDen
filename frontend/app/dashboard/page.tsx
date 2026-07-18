"use client";

import { useState, useEffect } from "react";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SiweMessage } from "siwe";
import { useSession, signIn, signOut } from "next-auth/react";
import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import { AlertTriangle, Calendar, DollarSign, ExternalLink, Mail, Key, Wallet, CheckCircle, XCircle, Clock, CreditCard, HelpCircle, History } from "lucide-react";

// ✅ UPDATED: Added check-in/out date fields
type Booking = {
  bookingId: string;
  status: string;
  guestName: string;
  guestEmail: string;
  
  // ✅ NEW: Date fields
  numberOfNights: number | null;
  checkInDate: string | null;   // ✅ NEW
  checkOutDate: string | null;  // ✅ NEW
  
  // Pricing
  pricePerNightUSDC: number | null;
  pricePerNightUSDT: number | null;
  selectedRoomPriceUSDC: number | null;
  selectedRoomPriceUSDT: number | null;
  selectedRoomName: string | null;
  
  // Payment
  paymentAmount: number | null;
  paymentToken: string | null;
  txHash: string | null;        // ✅ Transaction hash
  chain: string | null;
  chainId: number | null;
  blockNumber: number | null;
  
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  
  stay: {
    id: string;
    stayId: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    duration: number;
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
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  // Safe access to session data with null checks
  const userEmail = session?.user?.email;
  const userName = session?.user?.name;
  const linkedWallet = session?.user
    ? (session.user as any).walletAddress
    : null;
  const isWalletLinked = Boolean(linkedWallet);

  // Helper function to truncate wallet addresses
  const truncateAddress = (addr: string | null) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // ✅ Helper to get block explorer URL
  const getExplorerUrl = (chainId: number | null, txHash: string) => {
    const explorers: Record<number, string> = {
      42161: 'https://arbiscan.io',
      56: 'https://bscscan.com',
      8453: 'https://basescan.org',
    };
    const baseUrl = chainId ? explorers[chainId] || 'https://etherscan.io' : 'https://etherscan.io';
    return `${baseUrl}/tx/${txHash}`;
  };

  // ✅ Helper to get chain name
  const getChainName = (chainId: number | null): string => {
    const chains: Record<number, string> = {
      42161: 'Arbitrum',
      56: 'BNB Chain',
      8453: 'Base',
    };
    return chainId ? (chains[chainId] || `Chain ${chainId}`) : 'Unknown';
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

  const handleUnlinkWallet = async () => {
    if (
      !confirm(
        "Are you sure you want to unlink your wallet? You will still be able to log in with your Google account."
      )
    )
      return;

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

  const getStatusInfo = (status: string, expiresAt: string | null) => {
    const now = new Date();
    const expiry = expiresAt ? new Date(expiresAt) : null;
    const isExpired = expiry && expiry < now;

    switch (status) {
      case "WAITLISTED":
        return {
          icon: <Clock size={18} strokeWidth={3} className="shrink-0" />,
          label: "Under Review",
          classes: "bg-[#f7eedb] border-2 border-[#2c331f] text-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f]",
          message:
            "Your application is being reviewed. We'll notify you within 24-48 hours.",
        };
      case "PENDING":
        if (isExpired) {
          return {
            icon: <History size={18} strokeWidth={3} className="shrink-0" />,
            label: "Payment Expired",
            classes: "bg-[#f7eedb] border-2 border-[#2c331f] text-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f]",
            message: "Your payment session expired. Please contact support.",
          };
        }
        return {
          icon: <CreditCard size={18} strokeWidth={3} className="shrink-0" />,
          label: "Payment Required",
          classes: "bg-[#9db47d] border-2 border-[#2c331f] text-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f]",
          message:
            "Your application was approved! Complete payment to confirm your spot.",
        };
      case "CONFIRMED":
        return {
          icon: <CheckCircle size={18} strokeWidth={3} className="shrink-0" />,
          label: "Confirmed",
          classes: "bg-[#2c331f] border-2 border-[#2c331f] text-[#f7eedb] shadow-[2px_2px_0px_0px_#2c331f]",
          message:
            "All set! Your spot is confirmed. Check your email for details.",
        };
      case "CANCELLED":
        return {
          icon: <XCircle size={18} strokeWidth={3} className="shrink-0" />,
          label: "Cancelled",
          classes: "bg-[#f7eedb] border-2 border-[#2c331f] text-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f]",
          message: "This booking was cancelled.",
        };
      default:
        return {
          icon: <HelpCircle size={18} strokeWidth={3} className="shrink-0" />,
          label: status,
          classes: "bg-[#f7eedb] border-2 border-[#2c331f] text-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f]",
          message: "",
        };
    }
  };

  // Loading state
  if (sessionStatus === "loading") {
    return (
      <div className="max-w-[1000px] mx-auto p-6 md:p-10 min-h-[80vh] flex items-center justify-center bg-[#f7eedb]">
        <div className="text-center bg-white border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-8 rounded-2xl">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#2c331f] font-bold tracking-widest uppercase text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session?.user) {
    return (
      <div className="max-w-[1000px] mx-auto p-6 md:p-10 min-h-[80vh] flex items-center justify-center bg-[#f7eedb]">
        <div className="text-center p-10 md:p-16 bg-white border-2 border-[#2c331f] shadow-[8px_8px_0px_0px_#2c331f] rounded-2xl w-full max-w-md">
          <h2 className="text-4xl font-black mb-4 text-[#2c331f] font-display tracking-tight">
            Sign In Required
          </h2>
          <p className="text-sm font-bold text-[#5a6b3a] mb-8 uppercase tracking-widest">
            Please sign in to view your dashboard
          </p>
          <Link
            href="/auth/signin"
            className="block w-full py-4 px-6 bg-[#9db47d] text-[#2c331f] border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 rounded-xl font-bold uppercase tracking-wider transition-all"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto p-6 md:p-10 min-h-screen bg-[#f7eedb] text-[#2c331f]">
      {/* Header Section */}
      <div className="mb-12">
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-5xl md:text-6xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
              Dashboard
            </h1>
            <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-sm">
              {userName && `Welcome, ${userName}`}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="py-2.5 px-6 bg-[#2c331f] text-[#f7eedb] rounded-full hover:bg-white hover:text-[#2c331f] border-2 border-[#2c331f] transition-colors font-bold uppercase tracking-widest text-[10px]"
          >
            Sign Out
          </button>
        </div>

        {/* Account Connections */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Google Connection Card */}
          <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <h3 className="text-xl font-black mb-4 text-[#2c331f] flex items-center gap-3 tracking-tight">
              <Mail size={24} strokeWidth={2.5} className="text-[#2c331f]" /> Google Account
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={20} strokeWidth={3} className="text-[#9db47d] mt-1 shrink-0" />
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-1">
                    Primary Account
                  </div>
                  <div className="bg-[#f7eedb] border-2 border-[#2c331f] px-4 py-2.5 rounded-xl text-sm font-bold text-[#2c331f] break-all">
                    {userEmail}
                  </div>
                </div>
              </div>
              <p className="text-[#2c331f]/70 font-medium text-sm">
                This is your primary account for signing in.
              </p>
            </div>
          </div>

          {/* Wallet Connection Card */}
          <div className="bg-[#9db47d] p-6 md:p-8 rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <h3 className="text-xl font-black mb-4 text-[#2c331f] flex items-center gap-3 tracking-tight">
              <Wallet size={24} strokeWidth={2.5} className="text-[#2c331f]" /> Wallet
            </h3>

            {isWalletLinked ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} strokeWidth={3} className="text-[#2c331f] mt-1 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest mb-1">
                      Linked Wallet
                    </div>
                    <code className="bg-[#f7eedb] border-2 border-[#2c331f] px-4 py-2.5 rounded-xl text-sm font-bold text-[#2c331f] block break-all">
                      {linkedWallet}
                    </code>
                  </div>
                </div>
                <button
                  onClick={handleUnlinkWallet}
                  className="py-3 px-6 bg-white text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all text-sm font-bold w-full uppercase tracking-wider"
                >
                  Unlink Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[#2c331f] font-medium text-sm mb-4">
                  Link your wallet to manage bookings and make crypto payments.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[150px] custom-connect-button-wrapper">
                    <ConnectKitButton />
                  </div>
                  {isConnected && (
                    <button
                      onClick={handleLinkWallet}
                      disabled={isLinkingWallet}
                      className="flex-1 min-w-[150px] py-3 px-6 bg-[#2c331f] text-[#f7eedb] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm uppercase tracking-wider"
                    >
                      {isLinkingWallet ? "Linking..." : "Link Wallet"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Wallet Mismatch Warning */}
        {isWalletMismatched && (
          <div className="mb-8 p-6 md:p-8 bg-[#e8c37b] rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <h3 className="text-xl font-black text-[#2c331f] flex items-center gap-3 tracking-tight">
              <AlertTriangle strokeWidth={3} className="text-[#2c331f]" size={24} />
              Wallet Mismatch
            </h3>
            <p className="mt-3 text-[#2c331f] font-medium text-sm">
              The wallet currently connected in your browser does not match the
              wallet linked to this account.
            </p>

            <div className="mt-5 space-y-4 md:space-y-0 md:flex md:gap-4">
              <div className="flex-1">
                <div className="text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest mb-1">
                  Linked to Account
                </div>
                <code className="bg-white px-4 py-2.5 rounded-xl border-2 border-[#2c331f] text-sm font-bold block break-all text-[#5a6b3a]">
                  {truncateAddress(linkedWallet)}
                </code>
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest mb-1">
                  Currently Connected
                </div>
                <code className="bg-white px-4 py-2.5 rounded-xl border-2 border-[#2c331f] text-sm font-bold block break-all text-red-600">
                  {truncateAddress(address)}
                </code>
              </div>
            </div>

            <p className="mt-5 text-sm font-black text-[#2c331f] uppercase tracking-wider">
              Please switch the active wallet in your browser to your linked address to proceed.
            </p>
          </div>
        )}

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
      </div>

      {/* Bookings Section */}
      <h2 className="text-4xl md:text-5xl font-black mb-8 text-[#2c331f] font-display tracking-tight">
        My Applications
      </h2>

      {loading ? (
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-5"></div>
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading your applications...</p>
        </div>
      ) : !linkedWallet && !isConnected ? (
        <div className="text-center p-10 md:p-16 bg-[#9db47d] rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <Wallet size={48} strokeWidth={2} className="mx-auto mb-5 text-[#2c331f]" />
          <h3 className="text-3xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
            Link Your Wallet
          </h3>
          <p className="text-[#2c331f]/80 font-bold uppercase tracking-widest text-xs mb-8">
            Connect and link your wallet to view your applications and bookings.
          </p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center p-10 md:p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <Calendar size={48} strokeWidth={2} className="mx-auto mb-5 text-[#2c331f]" />
          <h3 className="text-3xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
            No Applications Yet
          </h3>
          <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-xs mb-8">
            You haven't applied to any stays yet.
          </p>
          <Link
            href="/villas"
            className="inline-block py-3.5 px-8 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-sm"
          >
            Browse Available Popups
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {bookings.map((booking) => {
            const statusInfo = getStatusInfo(booking.status, booking.expiresAt);
            const isExpired =
              booking.expiresAt && new Date(booking.expiresAt) < new Date();
            
            // Calculate nights and dates
            const nights = booking.numberOfNights || booking.stay.duration || 0;
            const checkInDate = booking.checkInDate ? new Date(booking.checkInDate) : null;
            const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate) : null;
            
            // Get prices
            const perNightUSDC = booking.pricePerNightUSDC;
            const perNightUSDT = booking.pricePerNightUSDT;
            const totalUSDC = booking.selectedRoomPriceUSDC || booking.paymentAmount;
            const totalUSDT = booking.selectedRoomPriceUSDT;
            
            // Determine which token was used
            const paymentToken = booking.paymentToken || 
              (totalUSDC && totalUSDT ? 'USDC' : totalUSDC ? 'USDC' : 'USDT');
            
            return (
              <div
                key={booking.bookingId}
                className="bg-white p-6 md:p-8 rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] relative flex flex-col h-full"
              >
                <div
                  className={`inline-flex items-center gap-2 py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest mb-6 w-fit ${statusInfo.classes}`}
                >
                  {statusInfo.icon} {statusInfo.label}
                </div>

                <h3 className="text-3xl font-black mb-2 text-[#2c331f] font-display tracking-tight leading-tight">
                  {booking.stay.title}
                </h3>
                
                {/* Room name if selected */}
                {booking.selectedRoomName && (
                  <p className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#9db47d]"></span>
                    {booking.selectedRoomName}
                  </p>
                )}
                
                <p className="text-sm font-bold text-[#2c331f]/70 uppercase tracking-widest mb-6">
                  {booking.stay.location}
                </p>

                {/* Show Check-In/Out Dates */}
                {checkInDate && checkOutDate && (
                  <div className="bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl p-4 mb-6">
                    <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Calendar size={14} />
                      Your Stay Period
                    </p>
                    <div className="flex items-center justify-between text-[#2c331f]">
                      <div className="text-left">
                        <div className="text-[10px] font-bold text-[#2c331f]/50 uppercase tracking-widest mb-1">Check-in</div>
                        <div className="font-black text-sm">
                          {checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="flex-shrink-0 px-2">
                        <div className="text-center">
                          <div className="font-bold text-[#5a6b3a] text-xs px-3 py-1 border-2 border-[#2c331f] rounded-full bg-white">
                            {nights} night{nights !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-[#2c331f]/50 uppercase tracking-widest mb-1">Check-out</div>
                        <div className="font-black text-sm">
                          {checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-[#f7eedb]/50 rounded-xl mb-6 text-sm font-medium text-[#2c331f] border-2 border-[#2c331f] border-dashed">
                  {statusInfo.message}
                </div>

                <div className="flex-1"></div>

                <div className="border-t-2 border-[#2c331f] pt-6 mb-6">
                  <div className="flex justify-between items-center mb-3 text-sm flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Application ID:</span>
                    <code className="bg-[#f7eedb] px-2 py-1 rounded-md border-2 border-[#2c331f] text-[#2c331f] font-bold text-[10px]">
                      {booking.bookingId}
                    </code>
                  </div>
                  <div className="flex justify-between items-center mb-4 text-sm flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Applied on:</span>
                    <span className="text-[#2c331f] font-black text-xs">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Per-night pricing if available */}
                  {perNightUSDC && perNightUSDT && nights > 0 && (
                    <div className="bg-white border-2 border-[#2c331f] rounded-xl p-4 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest flex items-center gap-1">
                          <DollarSign size={14} />
                          Price per night
                        </span>
                        <span className="text-[#2c331f] font-black text-sm">
                          ${perNightUSDC} USDC / ${perNightUSDT} USDT
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Calculation:</span>
                        <span className="text-[#2c331f] font-bold text-[10px] bg-[#f7eedb] px-2 py-1 border border-[#2c331f] rounded">
                          ${perNightUSDC} × {nights} nights = ${totalUSDC || (perNightUSDC * nights).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Total amount */}
                  {(totalUSDC || totalUSDT || booking.paymentAmount) && (
                    <div className="flex justify-between items-center p-4 bg-[#2c331f] rounded-xl mb-4 text-sm flex-wrap gap-2 shadow-[2px_2px_0px_0px_#9db47d]">
                      <span className="text-[#f7eedb] font-bold uppercase tracking-widest text-[10px]">Total Amount</span>
                      <span className="text-[#9db47d] font-black text-xl">
                        ${booking.paymentAmount || totalUSDC} {paymentToken}
                      </span>
                    </div>
                  )}

                  {/* Transaction Hash */}
                  {booking.status === "CONFIRMED" && booking.txHash && (
                    <div className="bg-[#9db47d]/20 border-2 border-[#2c331f] rounded-xl p-4 mt-2">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                          Tx Hash:
                        </span>
                        <a
                          href={getExplorerUrl(booking.chainId, booking.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-bold text-[#2c331f] hover:text-[#5a6b3a] underline underline-offset-2"
                        >
                          {booking.txHash.slice(0, 8)}...{booking.txHash.slice(-6)}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      {booking.chainId && (
                        <div className="flex justify-between items-center text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest">
                          <span>Network:</span>
                          <span className="text-[#2c331f]">{getChainName(booking.chainId)}</span>
                        </div>
                      )}
                      {booking.blockNumber && (
                        <div className="flex justify-between items-center text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest mt-1">
                          <span>Block:</span>
                          <span className="text-[#2c331f]">#{booking.blockNumber}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {booking.status === "PENDING" && !isExpired && (
                  <Link
                    href={`/booking/${booking.bookingId}`}
                    className="block w-full py-4 px-6 bg-[#9db47d] text-[#2c331f] border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 text-center rounded-xl font-bold uppercase tracking-wider text-sm transition-all"
                  >
                    Complete Payment ✦
                  </Link>
                )}

                {booking.status === "WAITLISTED" && (
                  <Link
                    href={`/stay/${booking.stay.stayId}`}
                    className="block w-full py-4 px-6 bg-[#f7eedb] text-[#2c331f] border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 text-center rounded-xl font-bold uppercase tracking-wider text-sm transition-all"
                  >
                    View Popup Details ✦
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