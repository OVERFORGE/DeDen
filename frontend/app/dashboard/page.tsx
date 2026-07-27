"use client";

import { useState, useEffect } from "react";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SiweMessage } from "siwe";
import { useSession, signOut } from "next-auth/react";
import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Mail,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  HelpCircle,
  History,
  ChevronRight,
  Loader2,
  User,
  Pencil,
  Save,
  X,
  Activity,
  MessageCircle,
  MapPin,
  Sparkles,
} from "lucide-react";

type Booking = {
  bookingId: string;
  status: string;
  guestName: string;
  guestEmail: string;

  numberOfNights: number | null;
  checkInDate: string | null;
  checkOutDate: string | null;

  pricePerNightUSDC: number | null;
  pricePerNightUSDT: number | null;
  selectedRoomPriceUSDC: number | null;
  selectedRoomPriceUSDT: number | null;
  selectedRoomName: string | null;

  guestCount: number | null;

  requiresReservation: boolean | null;
  reservationAmount: number | null;
  reservationPaid: boolean | null;
  remainingAmount: number | null;
  remainingPaid: boolean | null;

  finalPrice: number | null;
  totalPaid: number | null;
  discountPercent: number | null;

  paymentAmount: number | null;
  paymentToken: string | null;
  txHash: string | null;
  chain: string | null;
  chainId: number | null;
  blockNumber: number | null;

  nftMinted: boolean;
  nftTokenId: string | null;
  nftContractAddress: string | null;
  nftTxHash: string | null;

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

type TicketSummary = {
  ticketCode: string;
  status: string;
  guestName: string | null;
  guestIndex: number;
  checkedInAt: string | null;
  issuedAt: string;
  stay: {
    stayId: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
  };
  booking: {
    bookingId: string;
    status: string;
  };
};

type Profile = {
  displayName: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  bio: string | null;
  gender: string | null;
  age: number | null;
  mobileNumber: string | null;
  socialTwitter: string | null;
  socialTelegram: string | null;
  socialLinkedin: string | null;
  socialGithub: string | null;
  socialWebsite: string | null;
};

type ActivityItem = {
  id: string;
  action: string;
  createdAt: string;
  stayTitle: string | null;
  bookingId: string | null;
};

// Maps raw ActivityLog action strings to a short human sentence.
const ACTIVITY_LABELS: Record<string, string> = {
  application_submitted: "Applied for a stay",
  application_resubmitted: "Re-applied for a stay",
  booking_extended: "Added guests to a booking",
  waitlist_approved: "Application approved",
  payment_submitted: "Payment submitted",
  payment_confirmed: "Payment confirmed",
  reservation_paid: "Reservation paid",
  remaining_payment_confirmed: "Remaining balance paid",
  nft_minted: "NFT ticket minted",
  ticket_checked_in: "Checked in at the venue",
  guest_list_opt_in: "Opted in to the guest list",
  guest_list_opt_out: "Opted out of the guest list",
  booking_refunded: "Booking refunded",
  email_resent: "Confirmation email resent",
};

type FilterKey = "ALL" | "ACTIVE" | "WAITLISTED" | "PENDING" | "RESERVED" | "CONFIRMED" | "PAST";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "WAITLISTED", label: "Under Review" },
  { key: "PENDING", label: "Payment Due" },
  { key: "RESERVED", label: "Reserved" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PAST", label: "Past / Closed" },
];

const PAST_STATUSES = ["EXPIRED", "CANCELLED", "REFUNDED", "FAILED"];

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

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<Profile>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Safe access to session data with null checks
  const userEmail = session?.user?.email;
  const userName = session?.user?.name;
  const linkedWallet = session?.user
    ? (session.user as any).walletAddress
    : null;
  const isWalletLinked = Boolean(linkedWallet);

  const truncateAddress = (addr: string | null) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

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

        // Bookings are owned by the session user (Booking.userId), NOT by a
        // wallet — a wallet is only needed at the moment of paying, to sign
        // the transaction.
        const res = await fetch("/api/user/bookings");
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
  }, [session, sessionStatus]);

  // Tickets are issued per guest once a booking is fully paid.
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    (async () => {
      try {
        const res = await fetch("/api/tickets");
        if (!res.ok) return;
        setTickets(await res.json());
      } catch (err) {
        console.error("[Dashboard] Failed to load tickets:", err);
      }
    })();
  }, [sessionStatus]);

  // Profile — previously only editable inline during the apply flow, with
  // no dedicated place to fix a typo'd phone number or add socials after
  // the fact.
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    (async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        setProfile(await res.json());
      } catch (err) {
        console.error("[Dashboard] Failed to load profile:", err);
      }
    })();
  }, [sessionStatus]);

  // Recent activity — ActivityLog already records everything; this is the
  // first user-facing view of it.
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    (async () => {
      try {
        const res = await fetch("/api/user/activity");
        if (!res.ok) return;
        setActivity(await res.json());
      } catch (err) {
        console.error("[Dashboard] Failed to load activity:", err);
      }
    })();
  }, [sessionStatus]);

  const startEditingProfile = () => {
    if (!profile) return;
    setProfileForm(profile);
    setProfileError(null);
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileForm.displayName,
          mobileNumber: profileForm.mobileNumber,
          gender: profileForm.gender,
          age: profileForm.age ? Number(profileForm.age) : undefined,
          socialTwitter: profileForm.socialTwitter,
          socialTelegram: profileForm.socialTelegram,
          socialLinkedin: profileForm.socialLinkedin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");
      setProfile(data.profile);
      setEditingProfile(false);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLinkWallet = async () => {
    if (!session?.user) {
      setLinkMessage("Please sign in first");
      return;
    }

    setIsLinkingWallet(true);
    setLinkMessage(null);
    setError(null);

    try {
      let currentAddress = address;
      let currentChainId = chainId;

      if (!currentAddress) {
        await connectAsync({ connector: injected() });

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

      const csrfRes = await fetch("/api/auth/csrf");
      if (!csrfRes.ok) throw new Error("Failed to fetch nonce");
      const { csrfToken } = await csrfRes.json();

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
      const signature = await signMessageAsync({ message: messageToSign });

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

      setLinkMessage("Wallet linked successfully!");
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
          icon: <Clock size={13} strokeWidth={3} />,
          label: "Under Review",
          classes: "bg-[#f7eedb] text-[#2c331f]",
          message: "Your application is being reviewed. We'll notify you within 24-48 hours.",
        };
      case "PENDING":
        if (isExpired) {
          return {
            icon: <History size={13} strokeWidth={3} />,
            label: "Payment Expired",
            classes: "bg-[#f7eedb] text-[#2c331f]",
            message: "Your payment session expired. Please contact support.",
          };
        }
        return {
          icon: <CreditCard size={13} strokeWidth={3} />,
          label: "Payment Required",
          classes: "bg-[#9db47d] text-[#2c331f]",
          message: "Your application was approved! Complete payment to confirm your spot.",
        };
      case "RESERVED":
        return {
          icon: <Clock size={13} strokeWidth={3} />,
          label: "Spot Reserved",
          classes: "bg-[#e8c37b] text-[#2c331f]",
          message: "Your deposit is paid and your spot is held. Pay the remaining balance to fully confirm.",
        };
      case "CONFIRMED":
        return {
          icon: <CheckCircle size={13} strokeWidth={3} />,
          label: "Confirmed",
          classes: "bg-[#2c331f] text-[#f7eedb]",
          message: "All set! Your spot is confirmed.",
        };
      case "EXPIRED":
        return {
          icon: <History size={13} strokeWidth={3} />,
          label: "Expired",
          classes: "bg-[#f7eedb] text-[#2c331f]",
          message: "This booking expired before payment was completed.",
        };
      case "REFUNDED":
        return {
          icon: <History size={13} strokeWidth={3} />,
          label: "Refunded",
          classes: "bg-[#f7eedb] text-[#2c331f]",
          message: "This booking was refunded.",
        };
      case "FAILED":
        return {
          icon: <XCircle size={13} strokeWidth={3} />,
          label: "Payment Failed",
          classes: "bg-[#f7eedb] text-[#2c331f]",
          message: "The payment could not be verified. Please try again or contact support.",
        };
      case "CANCELLED":
        return {
          icon: <XCircle size={13} strokeWidth={3} />,
          label: "Cancelled",
          classes: "bg-[#f7eedb] text-[#2c331f]",
          message: "This booking was cancelled.",
        };
      default:
        return {
          icon: <HelpCircle size={13} strokeWidth={3} />,
          label: status,
          classes: "bg-[#f7eedb] text-[#2c331f]",
          message: "",
        };
    }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#f7eedb]">
        <Loader2 className="w-10 h-10 text-[#2c331f] animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#f7eedb] p-6">
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

  const amountDueFor = (b: Booking): number => {
    if (b.status === "RESERVED") return b.remainingAmount ?? 0;
    if (b.status === "PENDING") {
      return b.requiresReservation && !b.reservationPaid
        ? (b.reservationAmount ?? 0)
        : (b.finalPrice ?? b.paymentAmount ?? 0);
    }
    return 0;
  };

  const summary = {
    active: bookings.filter((b) => !PAST_STATUSES.includes(b.status)).length,
    confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
    validTickets: tickets.filter((t) => t.status === "ISSUED").length,
    totalDue: bookings.reduce((sum, b) => sum + amountDueFor(b), 0),
  };

  const counts: Record<FilterKey, number> = {
    ALL: bookings.length,
    ACTIVE: summary.active,
    WAITLISTED: bookings.filter((b) => b.status === "WAITLISTED").length,
    PENDING: bookings.filter((b) => b.status === "PENDING").length,
    RESERVED: bookings.filter((b) => b.status === "RESERVED").length,
    CONFIRMED: summary.confirmed,
    PAST: bookings.filter((b) => PAST_STATUSES.includes(b.status)).length,
  };

  const filteredBookings = bookings.filter((b) => {
    switch (filter) {
      case "ALL":
        return true;
      case "ACTIVE":
        return !PAST_STATUSES.includes(b.status);
      case "PAST":
        return PAST_STATUSES.includes(b.status);
      default:
        return b.status === filter;
    }
  });

  // Nearest upcoming confirmed/reserved stay — with several applications in
  // different states, "what's actually happening soon" was buried in a grid
  // with no ordering by date.
  const nextStay = bookings
    .filter(
      (b) =>
        ["CONFIRMED", "RESERVED"].includes(b.status) &&
        b.checkInDate &&
        new Date(b.checkInDate) > new Date()
    )
    .sort((a, b) => new Date(a.checkInDate!).getTime() - new Date(b.checkInDate!).getTime())[0];

  const daysUntil = nextStay?.checkInDate
    ? Math.ceil((new Date(nextStay.checkInDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-[#f7eedb] text-[#2c331f]">
      <div className="max-w-[1200px] mx-auto p-5 md:p-8 flex flex-col md:flex-row gap-6">
        {/* ============ LEFT SIDEBAR ============ */}
        <aside className="md:w-[260px] shrink-0 space-y-4 md:sticky md:top-6 md:self-start">
          <div>
            <h1 className="text-2xl font-black text-[#2c331f] font-display tracking-tight leading-none">
              Dashboard
            </h1>
            {userName && (
              <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-[10px] mt-1">
                {userName}
              </p>
            )}
          </div>

          {/* Account card */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] p-4 space-y-3">
            <div className="flex items-center gap-2 min-w-0">
              <Mail size={14} strokeWidth={2.5} className="text-[#5a6b3a] shrink-0" />
              <span className="text-xs font-bold text-[#2c331f] truncate">{userEmail}</span>
            </div>

            <div className="h-px bg-[#2c331f]/10" />

            {isWalletLinked ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Wallet size={14} strokeWidth={2.5} className="text-[#5a6b3a] shrink-0" />
                  <code className="text-[10px] font-bold text-[#2c331f] truncate">
                    {truncateAddress(linkedWallet)}
                  </code>
                </div>
                <button
                  onClick={handleUnlinkWallet}
                  className="text-[9px] font-bold uppercase tracking-widest text-[#5a6b3a] hover:text-red-600 shrink-0"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest leading-relaxed">
                  No wallet linked — only needed to pay
                </p>
                <div className="flex items-center gap-2">
                  <div className="scale-90 origin-left custom-connect-button-wrapper">
                    <ConnectKitButton />
                  </div>
                  {isConnected && (
                    <button
                      onClick={handleLinkWallet}
                      disabled={isLinkingWallet}
                      className="py-1.5 px-3 bg-[#2c331f] text-[#f7eedb] rounded-lg border-2 border-[#2c331f] hover:bg-[#3a4f26] transition-colors disabled:opacity-50 font-bold text-[9px] uppercase tracking-widest"
                    >
                      {isLinkingWallet ? "..." : "Link"}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="h-px bg-[#2c331f]/10" />

            {/* Profile — the only place these fields could previously be
                changed was the apply-for-a-stay form. A typo'd phone number
                or a missing X handle (which "Who's Coming" relies on) had no
                fix short of re-applying to something. */}
            {!editingProfile ? (
              <button
                onClick={startEditingProfile}
                disabled={!profile}
                className="w-full flex items-center justify-between gap-2 text-left disabled:opacity-40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <User size={12} strokeWidth={2.5} className="text-[#5a6b3a] shrink-0" />
                    <span className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest">Profile</span>
                  </div>
                  <p className="text-xs font-bold text-[#2c331f] truncate mt-0.5">
                    {profile?.mobileNumber || profile?.socialTwitter
                      ? [profile?.mobileNumber, profile?.socialTwitter && `@${profile.socialTwitter}`]
                          .filter(Boolean)
                          .join(" · ")
                      : "Add phone & socials"}
                  </p>
                </div>
                <Pencil size={12} className="text-[#5a6b3a] shrink-0" />
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <User size={12} strokeWidth={2.5} className="text-[#5a6b3a]" />
                  <span className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest">Edit Profile</span>
                </div>

                <input
                  type="text"
                  placeholder="Display name"
                  value={profileForm.displayName || ""}
                  onChange={(e) => setProfileForm((p) => ({ ...p, displayName: e.target.value }))}
                  className="w-full text-xs font-bold text-[#2c331f] bg-[#f7eedb] border border-[#2c331f]/20 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#2c331f]"
                />
                <input
                  type="text"
                  placeholder="Phone number"
                  value={profileForm.mobileNumber || ""}
                  onChange={(e) => setProfileForm((p) => ({ ...p, mobileNumber: e.target.value }))}
                  className="w-full text-xs font-bold text-[#2c331f] bg-[#f7eedb] border border-[#2c331f]/20 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#2c331f]"
                />
                <input
                  type="text"
                  placeholder="X handle (no @)"
                  value={profileForm.socialTwitter || ""}
                  onChange={(e) => setProfileForm((p) => ({ ...p, socialTwitter: e.target.value.replace(/^@/, "") }))}
                  className="w-full text-xs font-bold text-[#2c331f] bg-[#f7eedb] border border-[#2c331f]/20 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#2c331f]"
                />
                <input
                  type="text"
                  placeholder="Telegram handle"
                  value={profileForm.socialTelegram || ""}
                  onChange={(e) => setProfileForm((p) => ({ ...p, socialTelegram: e.target.value }))}
                  className="w-full text-xs font-bold text-[#2c331f] bg-[#f7eedb] border border-[#2c331f]/20 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#2c331f]"
                />

                {profileError && (
                  <p className="text-[10px] font-bold text-red-600">{profileError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#2c331f] text-[#f7eedb] rounded-lg border-2 border-[#2c331f] hover:bg-[#3a4f26] transition-colors disabled:opacity-50 font-bold text-[9px] uppercase tracking-widest"
                  >
                    {savingProfile ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Save
                  </button>
                  <button
                    onClick={() => setEditingProfile(false)}
                    disabled={savingProfile}
                    className="py-1.5 px-3 bg-[#f7eedb] text-[#2c331f] rounded-lg border-2 border-[#2c331f] hover:bg-[#ede3c9] transition-colors font-bold text-[9px] uppercase tracking-widest"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full py-2 bg-[#f7eedb] text-[#2c331f] rounded-lg border-2 border-[#2c331f] hover:bg-[#ede3c9] transition-colors font-bold uppercase tracking-widest text-[9px]"
            >
              Sign Out
            </button>
          </div>

          {/* Summary stats */}
          {!loading && bookings.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Active" value={summary.active} />
              <StatTile label="Confirmed" value={summary.confirmed} />
              <StatTile label="Tickets" value={summary.validTickets} />
              <StatTile
                label="Due"
                value={summary.totalDue > 0 ? `$${summary.totalDue.toFixed(2)}` : "—"}
                accent={summary.totalDue > 0}
              />
            </div>
          )}

          {/* Filters — this is the piece that was entirely missing before:
              the only way to see e.g. just confirmed bookings was to scroll
              past everything else. */}
          {!loading && bookings.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] p-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    filter === f.key
                      ? "bg-[#2c331f] text-[#f7eedb]"
                      : "text-[#5a6b3a] hover:bg-[#f7eedb]"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                      filter === f.key ? "bg-[#9db47d] text-[#2c331f]" : "bg-[#f7eedb] text-[#2c331f]"
                    }`}
                  >
                    {counts[f.key]}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Link
            href="/villas"
            className="block w-full py-2.5 px-4 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] hover:bg-[#8ba36c] transition-colors font-bold text-[10px] uppercase tracking-widest text-center"
          >
            Browse Stays
          </Link>

          {/* Help — previously nothing on the page said who to contact if a
              payment went sideways or a question came up. */}
          <a
            href="mailto:bookings@deden.space"
            className="flex items-center gap-2 px-4 py-2.5 text-[#5a6b3a] hover:text-[#2c331f] transition-colors text-[10px] font-bold uppercase tracking-widest"
          >
            <MessageCircle size={13} strokeWidth={2.5} />
            Need help? bookings@deden.space
          </a>
        </aside>

        {/* ============ RIGHT CONTENT ============ */}
        <main className="flex-1 min-w-0">
          {isWalletMismatched && (
            <div className="mb-6 p-4 bg-[#e8c37b] rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f]">
              <h3 className="text-sm font-black text-[#2c331f] flex items-center gap-2 mb-2">
                <AlertTriangle strokeWidth={3} size={16} /> Wallet Mismatch
              </h3>
              <p className="text-xs font-medium text-[#2c331f]">
                Connected wallet ({truncateAddress(address)}) doesn't match your linked wallet (
                {truncateAddress(linkedWallet)}). Switch wallets in your browser to proceed.
              </p>
            </div>
          )}

          {linkMessage && (
            <div className="mb-4 p-3 bg-green-50 border-2 border-green-200 text-green-800 rounded-xl text-xs font-bold">
              {linkMessage}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 text-red-800 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* Next Stay spotlight — with several applications in different
              states, what's actually coming up soonest was buried in the
              grid below with no date ordering. */}
          {nextStay && (
            <Link
              href={`/dashboard/booking/${nextStay.bookingId}`}
              className="block mb-6 p-5 bg-[#2c331f] rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#9db47d] hover:shadow-[0px_0px_0px_0px_#9db47d] hover:translate-y-0.5 hover:translate-x-0.5 transition-all"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#9db47d] uppercase tracking-widest mb-1.5">
                    <Sparkles size={12} /> Your Next Stay
                  </div>
                  <h3 className="text-xl font-black text-[#f7eedb] font-display tracking-tight truncate">
                    {nextStay.stay.title}
                  </h3>
                  <p className="text-[10px] font-bold text-[#f7eedb]/60 uppercase tracking-widest mt-1 flex items-center gap-1">
                    <MapPin size={11} /> {nextStay.stay.location}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-black text-[#9db47d] font-display leading-none">
                    {daysUntil}
                  </div>
                  <div className="text-[9px] font-bold text-[#f7eedb]/60 uppercase tracking-widest mt-1">
                    day{daysUntil !== 1 ? "s" : ""} away
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Tickets */}
          {tickets.length > 0 && (
            <div className="mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-black text-[#2c331f] font-display tracking-tight">
                  My Tickets
                </h2>
                <p className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                  {tickets.length} issued
                </p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {tickets.map((ticket) => (
                  <Link
                    key={ticket.ticketCode}
                    href={`/dashboard/booking/${ticket.booking.bookingId}`}
                    className="shrink-0 w-[220px] bg-white rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] p-3 hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-0.5 hover:translate-x-0.5 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-black truncate">{ticket.stay.title}</span>
                      <span
                        className={`shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                          ticket.status === "CHECKED_IN"
                            ? "bg-[#2c331f] text-[#f7eedb]"
                            : ticket.status === "VOID"
                              ? "bg-[#f7eedb] text-[#2c331f]"
                              : "bg-[#9db47d] text-[#2c331f]"
                        }`}
                      >
                        {ticket.status === "CHECKED_IN" ? "In" : ticket.status === "VOID" ? "Void" : "Valid"}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest truncate">
                      {ticket.guestName || `Guest ${ticket.guestIndex + 1}`}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Applications */}
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-black text-[#2c331f] font-display tracking-tight">
              My Applications
            </h2>
            <p className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest">
              {filteredBookings.length} of {bookings.length}
            </p>
          </div>

          {loading ? (
            <div className="text-center p-14 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f]">
              <Loader2 className="w-8 h-8 text-[#2c331f] animate-spin mx-auto mb-3" />
              <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">
                Loading your applications...
              </p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center p-14 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f]">
              <Calendar size={40} strokeWidth={2} className="mx-auto mb-4 text-[#2c331f]" />
              <h3 className="text-xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
                No Applications Yet
              </h3>
              <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-[10px] mb-6">
                You haven't applied to any stays yet.
              </p>
              <Link
                href="/villas"
                className="inline-block py-3 px-6 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-0.5 hover:translate-x-0.5 transition-all font-bold uppercase tracking-wider text-xs"
              >
                Browse Available Popups
              </Link>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center p-10 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f]">
              <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-[10px]">
                Nothing in this filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredBookings.map((booking) => {
                const statusInfo = getStatusInfo(booking.status, booking.expiresAt);
                const isExpired = booking.expiresAt && new Date(booking.expiresAt) < new Date();

                const nights = booking.numberOfNights || booking.stay.duration || 0;
                const checkInDate = booking.checkInDate ? new Date(booking.checkInDate) : null;
                const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate) : null;
                const partySize = booking.guestCount ?? 1;

                const bookingTotal =
                  booking.finalPrice ?? booking.selectedRoomPriceUSDC ?? booking.paymentAmount ?? null;

                // A PENDING booking past its payment window is EXPIRED, not
                // payable — the amount was showing as "Due" even when the
                // booking could no longer actually be paid.
                const amountDue =
                  booking.status === "RESERVED"
                    ? booking.remainingAmount
                    : booking.status === "PENDING" && !isExpired
                      ? booking.requiresReservation && !booking.reservationPaid
                        ? booking.reservationAmount
                        : bookingTotal
                      : null;

                const isPayable = (booking.status === "PENDING" && !isExpired) || booking.status === "RESERVED";

                return (
                  <Link
                    key={booking.bookingId}
                    href={`/dashboard/booking/${booking.bookingId}`}
                    className="group bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-0.5 hover:translate-x-0.5 transition-all overflow-hidden flex flex-col"
                  >
                    <div className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest ${statusInfo.classes}`}
                        >
                          {statusInfo.icon} {statusInfo.label}
                        </span>
                        {bookingTotal !== null && (
                          <div className="text-right shrink-0">
                            <div className="text-base font-black text-[#2c331f] font-display leading-none">
                              ${booking.status === "CONFIRMED" ? (booking.totalPaid ?? bookingTotal) : bookingTotal}
                            </div>
                          </div>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-[#2c331f] font-display tracking-tight leading-tight truncate">
                        {booking.stay.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-1.5 text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest mt-1">
                        <span className="truncate">{booking.stay.location}</span>
                        {partySize > 1 && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>{partySize} guests</span>
                          </>
                        )}
                        {checkInDate && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>{nights}N</span>
                          </>
                        )}
                      </div>
                    </div>

                    {amountDue !== null && amountDue !== undefined && amountDue > 0 && (
                      <div className="px-4 py-2 bg-[#e8c37b] flex items-center justify-between gap-2">
                        <span className="text-[9px] font-bold text-[#2c331f] uppercase tracking-widest">
                          {booking.status === "RESERVED" ? "Remaining" : "Due"}
                        </span>
                        <span className="text-xs font-black text-[#2c331f]">
                          ${amountDue} {booking.paymentToken || "USDC"}
                        </span>
                      </div>
                    )}

                    {/* Real button-styled CTA — the whole card is a link, but a
                        line of small uppercase text plus a chevron didn't read
                        as "this is clickable" to guests. */}
                    <div className="mt-auto px-4 py-3 border-t border-[#2c331f]/10">
                      <span
                        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-[#2c331f] font-bold uppercase tracking-widest text-[10px] transition-colors ${
                          isPayable
                            ? "bg-[#e8c37b] text-[#2c331f] group-hover:bg-[#e0b563]"
                            : "bg-[#f7eedb] text-[#2c331f] group-hover:bg-[#ede3c9]"
                        }`}
                      >
                        {booking.status === "PENDING" && !isExpired
                          ? "Complete Payment"
                          : booking.status === "RESERVED"
                            ? "Pay Balance"
                            : "View Details"}
                        <ChevronRight size={13} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Recent Activity — ActivityLog already records every meaningful
              event; this is the first place a guest can actually see it. */}
          {activity.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-black text-[#2c331f] font-display tracking-tight mb-3">
                Recent Activity
              </h2>
              <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] divide-y divide-[#2c331f]/10">
                {activity.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                    <Activity size={14} strokeWidth={2.5} className="text-[#5a6b3a] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#2c331f] truncate">
                        {ACTIVITY_LABELS[item.action] || item.action.replace(/_/g, " ")}
                        {item.stayTitle && <span className="text-[#5a6b3a]"> · {item.stayTitle}</span>}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest shrink-0">
                      {timeAgo(item.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className={`${accent ? "bg-[#e8c37b]" : "bg-white"} rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] px-3 py-2.5`}
    >
      <div className="text-[8px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-lg font-black text-[#2c331f] font-display leading-none">{value}</div>
    </div>
  );
}

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
