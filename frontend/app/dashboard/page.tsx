"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import {
  Calendar,
  Mail,
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
  LogOut,
  Ticket,
  ArrowRight,
  Zap,
  TrendingUp,
  Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { key: "WAITLISTED", label: "Review" },
  { key: "PENDING", label: "Pay Now" },
  { key: "RESERVED", label: "Reserved" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PAST", label: "Past" },
];

const PAST_STATUSES = ["EXPIRED", "CANCELLED", "REFUNDED", "FAILED"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function getActivityIcon(action: string) {
  if (action.includes("payment") || action.includes("reservation")) return <CreditCard size={12} />;
  if (action.includes("checked_in")) return <CheckCircle size={12} />;
  if (action.includes("nft")) return <Star size={12} />;
  if (action.includes("refund")) return <History size={12} />;
  if (action.includes("approved")) return <Zap size={12} />;
  return <Activity size={12} />;
}

// ─── Profile Drawer ───────────────────────────────────────────────────────────

function ProfileDrawer({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const [form, setForm] = useState<Partial<Profile>>(profile);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          mobileNumber: form.mobileNumber,
          gender: form.gender,
          age: form.age ? Number(form.age) : undefined,
          socialTwitter: form.socialTwitter,
          socialTelegram: form.socialTelegram,
          socialLinkedin: form.socialLinkedin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");
      onSaved(data.profile);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof Profile,
    placeholder: string,
    type: string = "text"
  ) => (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a] mb-1">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={(form[key] as string) || ""}
        onChange={(e) => {
          const val =
            key === "socialTwitter" ? e.target.value.replace(/^@/, "") : e.target.value;
          setForm((f) => ({ ...f, [key]: val }));
        }}
        className="w-full text-sm font-bold text-[#2c331f] bg-[#f7eedb] border-2 border-[#2c331f]/20 focus:border-[#2c331f] rounded-xl px-3 py-2.5 outline-none transition-colors placeholder:text-[#5a6b3a]/50"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-[#2c331f]/40 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#f7eedb] border-l-2 border-[#2c331f] shadow-[-8px_0_0_0_#2c331f] flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#2c331f] text-[#f7eedb] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">My Account</p>
            <h2 className="text-lg font-black font-display tracking-tight mt-0.5">Edit Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#f7eedb]/10 hover:bg-[#f7eedb]/20 transition-colors"
          >
            <X size={18} strokeWidth={2.5} className="text-[#f7eedb]" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-4">
          <div className="bg-white rounded-xl border-2 border-[#2c331f] p-4 space-y-3 shadow-[3px_3px_0_0_#2c331f]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5a6b3a]">Identity</p>
            {field("Display Name", "displayName", "Your name")}
            {field("Mobile Number", "mobileNumber", "+1 234 567 8900", "tel")}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a] mb-1">Gender</label>
              <select
                value={form.gender || ""}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="w-full text-sm font-bold text-[#2c331f] bg-[#f7eedb] border-2 border-[#2c331f]/20 focus:border-[#2c331f] rounded-xl px-3 py-2.5 outline-none appearance-none"
              >
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-[#2c331f] p-4 space-y-3 shadow-[3px_3px_0_0_#2c331f]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5a6b3a]">Socials</p>
            {field("X / Twitter (no @)", "socialTwitter", "yourhandle")}
            {field("Telegram", "socialTelegram", "@username")}
            {field("LinkedIn", "socialLinkedin", "linkedin.com/in/you")}
          </div>

          {err && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </p>
          )}

          <div className="flex gap-3 pb-4">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#2c331f] text-[#f7eedb] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#9db47d] hover:shadow-none hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="py-3 px-4 bg-white text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f] hover:shadow-none hover:translate-y-1 hover:translate-x-1 transition-all font-bold text-xs disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserDashboard() {
  const { data: session, status: sessionStatus } = useSession();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const userEmail = session?.user?.email;
  const userName = session?.user?.name;

  // ─── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus === "loading") { setLoading(true); return; }
    if (!session?.user) { setLoading(false); setBookings([]); return; }

    (async () => {
      try {
        setLoading(true); setError(null);
        const res = await fetch("/api/user/bookings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch bookings");
        setBookings(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/tickets");
        if (!res.ok) return;
        setTickets(await res.json());
      } catch {}
    })();
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        setProfile(await res.json());
      } catch {}
    })();
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/user/activity");
        if (!res.ok) return;
        setActivity(await res.json());
      } catch {}
    })();
  }, [sessionStatus]);

  // ─── Status helpers ─────────────────────────────────────────────────────────

  const getStatusInfo = (status: string, expiresAt: string | null) => {
    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    switch (status) {
      case "WAITLISTED": return { label: "Under Review", classes: "bg-[#f7eedb] text-[#2c331f] border-[#2c331f]", icon: <Clock size={11} strokeWidth={3} />, message: "Your application is being reviewed. We'll notify you within 24-48 hours." };
      case "PENDING":
        if (isExpired) return { label: "Expired", classes: "bg-gray-100 text-gray-600 border-gray-300", icon: <History size={11} strokeWidth={3} />, message: "Your payment session expired. Please contact support." };
        return { label: "Payment Due", classes: "bg-[#9db47d] text-[#2c331f] border-[#2c331f]", icon: <CreditCard size={11} strokeWidth={3} />, message: "Your application was approved! Complete payment to confirm your spot." };
      case "RESERVED": return { label: "Spot Reserved", classes: "bg-[#e8c37b] text-[#2c331f] border-[#2c331f]", icon: <Clock size={11} strokeWidth={3} />, message: "Deposit paid. Pay the remaining balance to fully confirm." };
      case "CONFIRMED": return { label: "Confirmed ✓", classes: "bg-[#2c331f] text-[#f7eedb] border-[#2c331f]", icon: <CheckCircle size={11} strokeWidth={3} />, message: "All set! Your spot is confirmed." };
      case "EXPIRED": return { label: "Expired", classes: "bg-gray-100 text-gray-600 border-gray-300", icon: <History size={11} strokeWidth={3} />, message: "This booking expired before payment was completed." };
      case "REFUNDED": return { label: "Refunded", classes: "bg-purple-100 text-purple-700 border-purple-200", icon: <History size={11} strokeWidth={3} />, message: "This booking was refunded." };
      case "FAILED": return { label: "Failed", classes: "bg-red-100 text-red-600 border-red-200", icon: <XCircle size={11} strokeWidth={3} />, message: "The payment could not be verified. Please contact support." };
      case "CANCELLED": return { label: "Cancelled", classes: "bg-red-100 text-red-600 border-red-200", icon: <XCircle size={11} strokeWidth={3} />, message: "This booking was cancelled." };
      default: return { label: status, classes: "bg-[#f7eedb] text-[#2c331f] border-[#2c331f]", icon: <HelpCircle size={11} strokeWidth={3} />, message: "" };
    }
  };

  // ─── Loading / unauthenticated ──────────────────────────────────────────────

  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#f7eedb] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#2c331f] animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-[#f7eedb] flex items-center justify-center p-6">
        <div className="text-center p-10 md:p-14 bg-white border-2 border-[#2c331f] shadow-[8px_8px_0_0_#2c331f] rounded-2xl w-full max-w-md">
          <div className="w-16 h-16 bg-[#f7eedb] rounded-full flex items-center justify-center border-2 border-[#2c331f] mx-auto mb-6">
            <User size={28} className="text-[#2c331f]" strokeWidth={2} />
          </div>
          <h2 className="text-3xl font-black mb-3 text-[#2c331f] font-display tracking-tight">Sign In Required</h2>
          <p className="text-sm font-bold text-[#5a6b3a] mb-8 uppercase tracking-widest">Please sign in to view your dashboard</p>
          <Link href="/auth/signin" className="block w-full py-4 px-6 bg-[#9db47d] text-[#2c331f] border-2 border-[#2c331f] shadow-[4px_4px_0_0_#2c331f] hover:shadow-none hover:translate-y-1 hover:translate-x-1 rounded-xl font-bold uppercase tracking-wider transition-all">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ─── Derived data ───────────────────────────────────────────────────────────

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
      case "ALL": return true;
      case "ACTIVE": return !PAST_STATUSES.includes(b.status);
      case "PAST": return PAST_STATUSES.includes(b.status);
      default: return b.status === filter;
    }
  });

  const nextStay = bookings
    .filter((b) => ["CONFIRMED", "RESERVED"].includes(b.status) && b.checkInDate && new Date(b.checkInDate) > new Date())
    .sort((a, b) => new Date(a.checkInDate!).getTime() - new Date(b.checkInDate!).getTime())[0];

  const daysUntil = nextStay?.checkInDate
    ? Math.ceil((new Date(nextStay.checkInDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const initials = getInitials(userName, userEmail);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Profile Drawer */}
      {showProfileDrawer && profile && (
        <ProfileDrawer
          profile={profile}
          onClose={() => setShowProfileDrawer(false)}
          onSaved={(p) => setProfile(p)}
        />
      )}

      <div className="min-h-screen bg-[#f7eedb] text-[#2c331f]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">

          {/* ── Profile Header ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0_0_#2c331f] p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-[#2c331f] flex items-center justify-center text-[#f7eedb] font-black text-xl font-display shrink-0 border-2 border-[#2c331f] shadow-[3px_3px_0_0_#9db47d]">
                {initials}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-[#2c331f] font-display tracking-tight truncate">
                  {userName || "Welcome back"}
                </h1>
                <p className="text-xs font-bold text-[#5a6b3a] truncate">{userEmail}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => profile && setShowProfileDrawer(true)}
                disabled={!profile}
                className="flex items-center gap-1.5 py-2 px-3 bg-[#f7eedb] text-[#2c331f] rounded-xl border-2 border-[#2c331f] hover:bg-[#ede3c9] transition-colors font-bold text-[10px] uppercase tracking-widest disabled:opacity-40"
              >
                <Pencil size={12} /> Edit Profile
              </button>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-1.5 py-2 px-3 bg-[#2c331f] text-[#f7eedb] rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0_0_#9db47d] hover:shadow-none hover:translate-y-0.5 hover:translate-x-0.5 transition-all font-bold text-[10px] uppercase tracking-widest"
              >
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          </div>

          {/* ── Alerts ───────────────────────────────────────────────────────── */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-300 text-red-700 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* ── Stats Strip ──────────────────────────────────────────────────── */}
          {!loading && bookings.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Active", value: summary.active, color: "bg-white", icon: <TrendingUp size={14} className="text-[#5a6b3a]" /> },
                { label: "Confirmed", value: summary.confirmed, color: "bg-[#9db47d]", icon: <CheckCircle size={14} className="text-[#2c331f]" /> },
                { label: "Tickets", value: summary.validTickets, color: "bg-white", icon: <Ticket size={14} className="text-[#5a6b3a]" /> },
                {
                  label: summary.totalDue > 0 ? "Amount Due" : "All Paid",
                  value: summary.totalDue > 0 ? `$${summary.totalDue.toFixed(0)}` : "✓",
                  color: summary.totalDue > 0 ? "bg-[#e8c37b]" : "bg-white",
                  icon: <CreditCard size={14} className="text-[#2c331f]" />,
                },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className={`${color} rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f] px-4 py-3 flex items-center justify-between`}>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#5a6b3a]">{label}</p>
                    <p className="text-2xl font-black text-[#2c331f] font-display mt-0.5 leading-none">{value}</p>
                  </div>
                  <div className="w-8 h-8 bg-white rounded-lg border border-[#2c331f]/20 flex items-center justify-center">
                    {icon}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Next Stay Hero ────────────────────────────────────────────────── */}
          {nextStay && (
            <Link
              href={`/dashboard/booking/${nextStay.bookingId}`}
              className="group block mb-5 bg-[#2c331f] rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0_0_#9db47d] hover:shadow-none hover:translate-y-1 hover:translate-x-1 transition-all overflow-hidden"
            >
              <div className="p-5 md:p-6 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#9db47d] uppercase tracking-widest mb-2">
                    <Sparkles size={11} /> Your Next Stay
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-[#f7eedb] font-display tracking-tight leading-tight truncate">
                    {nextStay.stay.title}
                  </h2>
                  <p className="text-[10px] font-bold text-[#f7eedb]/50 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                    <MapPin size={10} /> {nextStay.stay.location}
                  </p>
                  {nextStay.checkInDate && (
                    <p className="text-[10px] font-bold text-[#9db47d]/80 uppercase tracking-widest mt-1 flex items-center gap-1">
                      <Calendar size={10} />
                      Check-in: {new Date(nextStay.checkInDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-5xl md:text-6xl font-black text-[#9db47d] font-display leading-none">{daysUntil}</div>
                  <div className="text-[9px] font-bold text-[#f7eedb]/50 uppercase tracking-widest mt-1">
                    day{daysUntil !== 1 ? "s" : ""} away
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[#f7eedb]/60 group-hover:text-[#9db47d] transition-colors uppercase tracking-widest">
                    View Details <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* ── Main 2-col grid ───────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-5">

            {/* ── Left: Applications ─────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              {/* Filter Tabs */}
              {bookings.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 custom-scrollbar">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 font-bold uppercase tracking-widest text-[10px] transition-all ${
                        filter === f.key
                          ? "bg-[#2c331f] text-[#f7eedb] border-[#2c331f] shadow-[2px_2px_0_0_#9db47d]"
                          : "bg-white text-[#5a6b3a] border-[#2c331f]/30 hover:border-[#2c331f] hover:text-[#2c331f]"
                      }`}
                    >
                      {f.label}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black border ${
                        filter === f.key ? "bg-[#9db47d] text-[#2c331f] border-[#9db47d]" : "bg-[#f7eedb] text-[#2c331f] border-transparent"
                      }`}>
                        {counts[f.key]}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Section header */}
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-black text-[#2c331f] font-display tracking-tight">My Applications</h2>
                {bookings.length > 0 && (
                  <p className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                    {filteredBookings.length} of {bookings.length}
                  </p>
                )}
              </div>

              {/* Booking cards */}
              {loading ? (
                <div className="text-center p-12 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f]">
                  <Loader2 className="w-7 h-7 text-[#2c331f] animate-spin mx-auto mb-3" />
                  <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading…</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f]">
                  <div className="w-14 h-14 bg-[#f7eedb] rounded-2xl border-2 border-[#2c331f] flex items-center justify-center mx-auto mb-4">
                    <Calendar size={28} strokeWidth={1.5} className="text-[#2c331f]" />
                  </div>
                  <h3 className="text-lg font-black mb-2 text-[#2c331f] font-display tracking-tight">No Applications Yet</h3>
                  <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-[10px] mb-6">
                    You haven't applied to any stays yet.
                  </p>
                  <Link
                    href="/villas"
                    className="inline-flex items-center gap-2 py-3 px-6 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f] hover:shadow-none hover:translate-y-0.5 hover:translate-x-0.5 transition-all font-bold uppercase tracking-wider text-xs"
                  >
                    Browse Stays <ArrowRight size={14} />
                  </Link>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center p-10 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f]">
                  <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-[10px]">Nothing in this filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((booking) => {
                    const statusInfo = getStatusInfo(booking.status, booking.expiresAt);
                    const isExpired = booking.expiresAt && new Date(booking.expiresAt) < new Date();
                    const partySize = booking.guestCount ?? 1;
                    const bookingTotal = booking.finalPrice ?? booking.selectedRoomPriceUSDC ?? booking.paymentAmount ?? null;
                    const amountDue =
                      booking.status === "RESERVED"
                        ? booking.remainingAmount
                        : booking.status === "PENDING" && !isExpired
                        ? booking.requiresReservation && !booking.reservationPaid
                          ? booking.reservationAmount
                          : bookingTotal
                        : null;
                    const isPayable = (booking.status === "PENDING" && !isExpired) || booking.status === "RESERVED";
                    const nights = booking.numberOfNights || booking.stay.duration || 0;

                    return (
                      <Link
                        key={booking.bookingId}
                        href={`/dashboard/booking/${booking.bookingId}`}
                        className="group block bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f] hover:shadow-none hover:translate-y-0.5 hover:translate-x-0.5 transition-all overflow-hidden"
                      >
                        {/* Card body */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border-2 ${statusInfo.classes}`}>
                              {statusInfo.icon} {statusInfo.label}
                            </span>
                            {bookingTotal !== null && (
                              <div className="text-right shrink-0">
                                <div className="text-base font-black text-[#2c331f] font-display leading-none">
                                  ${booking.status === "CONFIRMED" ? (booking.totalPaid ?? bookingTotal) : bookingTotal}
                                </div>
                                {booking.paymentToken && (
                                  <p className="text-[9px] font-bold text-[#5a6b3a] uppercase">{booking.paymentToken}</p>
                                )}
                              </div>
                            )}
                          </div>

                          <h3 className="text-base font-black text-[#2c331f] font-display tracking-tight leading-tight">
                            {booking.stay.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest mt-1">
                            <span className="flex items-center gap-0.5"><MapPin size={9} /> {booking.stay.location}</span>
                            {partySize > 1 && <><span className="opacity-40">·</span><span>{partySize} guests</span></>}
                            {nights > 0 && <><span className="opacity-40">·</span><span>{nights}N</span></>}
                            {booking.checkInDate && (
                              <><span className="opacity-40">·</span>
                              <span className="flex items-center gap-0.5">
                                <Calendar size={9} />
                                {new Date(booking.checkInDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span></>
                            )}
                          </div>
                        </div>

                        {/* Due banner */}
                        {amountDue !== null && amountDue !== undefined && amountDue > 0 && (
                          <div className="px-4 py-2 bg-[#e8c37b] border-t-2 border-[#2c331f] flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#2c331f] uppercase tracking-widest">
                              {booking.status === "RESERVED" ? "Remaining Due" : "Payment Due"}
                            </span>
                            <span className="text-sm font-black text-[#2c331f]">
                              ${amountDue} {booking.paymentToken || "USDC"}
                            </span>
                          </div>
                        )}

                        {/* CTA */}
                        <div className="px-4 py-3 border-t border-[#2c331f]/10">
                          <span className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-[#2c331f] font-bold uppercase tracking-widest text-[10px] transition-colors ${
                            isPayable
                              ? "bg-[#e8c37b] text-[#2c331f] group-hover:bg-[#e0b563]"
                              : "bg-[#f7eedb] text-[#2c331f] group-hover:bg-[#ede3c9]"
                          }`}>
                            {booking.status === "PENDING" && !isExpired
                              ? "Complete Payment"
                              : booking.status === "RESERVED"
                              ? "Pay Balance"
                              : "View Details"}
                            <ChevronRight size={12} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Browse CTA */}
              {bookings.length > 0 && (
                <Link
                  href="/villas"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f] hover:shadow-none hover:translate-y-0.5 hover:translate-x-0.5 transition-all font-bold text-[10px] uppercase tracking-widest"
                >
                  <Sparkles size={13} /> Browse More Stays
                </Link>
              )}
            </div>

            {/* ── Right sidebar ───────────────────────────────────────────────── */}
            <div className="lg:w-72 shrink-0 space-y-4">

              {/* My Tickets */}
              {tickets.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-base font-black text-[#2c331f] font-display tracking-tight">My Tickets</h2>
                    <p className="text-[9px] font-bold text-[#5a6b3a] uppercase tracking-widest">{tickets.length} issued</p>
                  </div>
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <Link
                        key={ticket.ticketCode}
                        href={`/dashboard/booking/${ticket.booking.bookingId}`}
                        className="group flex items-center gap-3 bg-white rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0_0_#2c331f] hover:shadow-none hover:translate-y-0.5 hover:translate-x-0.5 transition-all p-3"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 border-[#2c331f] shrink-0 ${
                          ticket.status === "CHECKED_IN" ? "bg-[#2c331f]" : ticket.status === "VOID" ? "bg-gray-100" : "bg-[#9db47d]"
                        }`}>
                          <Ticket size={14} className={ticket.status === "CHECKED_IN" ? "text-[#f7eedb]" : "text-[#2c331f]"} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-[#2c331f] truncate">{ticket.stay.title}</p>
                          <p className="text-[9px] font-bold text-[#5a6b3a] truncate uppercase tracking-widest">
                            {ticket.guestName || `Guest ${ticket.guestIndex + 1}`}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                          ticket.status === "CHECKED_IN"
                            ? "bg-[#2c331f] text-[#f7eedb] border-[#2c331f]"
                            : ticket.status === "VOID"
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-[#9db47d] text-[#2c331f] border-[#2c331f]"
                        }`}>
                          {ticket.status === "CHECKED_IN" ? "In" : ticket.status === "VOID" ? "Void" : "Valid"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {activity.length > 0 && (
                <div>
                  <h2 className="text-base font-black text-[#2c331f] font-display tracking-tight mb-3">Recent Activity</h2>
                  <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[3px_3px_0_0_#2c331f] overflow-hidden">
                    {activity.slice(0, 8).map((item, i) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 px-4 py-3 ${i !== Math.min(activity.length, 8) - 1 ? "border-b border-[#2c331f]/10" : ""}`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#f7eedb] border border-[#2c331f]/20 flex items-center justify-center shrink-0 mt-0.5 text-[#5a6b3a]">
                          {getActivityIcon(item.action)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-[#2c331f] leading-snug">
                            {ACTIVITY_LABELS[item.action] || item.action.replace(/_/g, " ")}
                          </p>
                          {item.stayTitle && (
                            <p className="text-[9px] font-bold text-[#5a6b3a] truncate">{item.stayTitle}</p>
                          )}
                          <p className="text-[9px] font-bold text-[#2c331f]/40 uppercase tracking-widest mt-0.5">
                            {timeAgo(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Help */}
              <a
                href="mailto:bookings@deden.space"
                className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0_0_#2c331f] hover:shadow-none hover:translate-y-0.5 hover:translate-x-0.5 transition-all text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a] hover:text-[#2c331f]"
              >
                <MessageCircle size={13} strokeWidth={2.5} />
                Need help? Contact us
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
