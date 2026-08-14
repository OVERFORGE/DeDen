// File: app/admin/bookings/page.tsx
// ✅ UPDATED: Compact UI, collapsible revenue, inline BookingDetailModal, View Details eye button

"use client";

import { useState, useEffect, useCallback } from "react";
import { ApproveWaitlistButton } from "@/components/ApproveWaitlistButton";
import { BookingActionsMenu } from "@/components/admin/BookingActionsMenu";
import { chainConfig, getChainName } from "@/lib/config";
import { NFTS_ENABLED } from "@/lib/features";
import {
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Filter,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  Ticket,
  MapPin,
  Mail,
  Smartphone,
  Lock,
  Bed,
  Link as LinkIcon,
  RefreshCw,
  Eye,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type GuestDetail = {
  fullName?: string;
  email?: string;
  phone?: string;
  age?: string | number;
  gender?: string;
  country?: string;
  profession?: string;
  xHandle?: string;
  telegram?: string;
};

type Booking = {
  id: string;
  bookingId: string;
  status: string;
  guestName: string;
  guestEmail: string;
  guestGender?: string;
  guestAge?: number;
  guestMobile?: string;
  guestCount?: number;
  guests?: GuestDetail[];
  paymentAmount?: number;
  totalPaid?: number;
  paymentToken?: string;
  selectedRoomName?: string;
  selectedRoomPriceUSDC?: number;
  selectedRoomPriceUSDT?: number;
  numberOfNights?: number;
  pricePerNightUSDC?: number;
  pricePerNightUSDT?: number;
  requiresReservation?: boolean;
  reservationAmount?: number;
  reservationPaid?: boolean;
  remainingAmount?: number;
  remainingDueDate?: string;
  checkInDate?: string;
  checkOutDate?: string;
  txHash?: string;
  nftMinted?: boolean;
  chain?: string;
  chainId?: number;
  blockNumber?: number;
  expiresAt?: string;
  confirmedAt?: string;
  createdAt: string;
  stay: {
    id: string;
    stayId: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    rooms?: any[];
  };
  user: {
    walletAddress?: string;
    displayName: string;
    email: string;
    role?: string;
    firstName?: string;
    lastName?: string;
    mobileNumber?: string;
    socialTwitter?: string;
    socialTelegram?: string;
    socialLinkedin?: string;
    gender?: string;
    age?: number;
  };
};

type TabType = "WAITLISTED" | "PENDING" | "RESERVED" | "CONFIRMED" | "ALL";

type StatsResponse = {
  totalBookings: number;
  counts: Record<string, number>;
  revenue: Record<string, number>;
  byChain: Record<string, { USDC: number; USDT: number }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getBookingChainName = (chainId?: number): string =>
  chainId ? getChainName(chainId) : "Unknown";

const PAGE_SIZE = 25;

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    WAITLISTED: { bg: "bg-[#f7eedb]", text: "text-[#2c331f]", label: "Waitlisted" },
    PENDING: { bg: "bg-[#9db47d]", text: "text-[#2c331f]", label: "Pending" },
    RESERVED: { bg: "bg-[#e8c37b]", text: "text-[#2c331f]", label: "Reserved" },
    CONFIRMED: { bg: "bg-[#2c331f]", text: "text-[#f7eedb]", label: "Confirmed" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
    EXPIRED: { bg: "bg-gray-100", text: "text-gray-600", label: "Expired" },
    FAILED: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
    REFUNDED: { bg: "bg-purple-100", text: "text-purple-700", label: "Refunded" },
  };
  const s = styles[status] || { bg: "bg-gray-100", text: "text-gray-700", label: status };
  return (
    <span
      className={`${s.bg} ${s.text} inline-flex items-center px-2.5 py-1 rounded-md border-2 border-[#2c331f] text-[10px] font-black uppercase tracking-widest`}
    >
      {s.label}
    </span>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

function BookingDetailModal({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking;
  onClose: () => void;
  onDone: () => void;
}) {
  const [resyncBusy, setResyncBusy] = useState(false);

  const handleResync = async () => {
    setResyncBusy(true);
    try {
      const [ticketsRes, nftRes] = await Promise.all([
        fetch(`/api/admin/bookings/${booking.bookingId}/backfill-tickets`, { method: "POST" }),
        NFTS_ENABLED
          ? fetch(`/api/admin/bookings/${booking.bookingId}/retry-nft`, { method: "POST" })
          : Promise.resolve(null),
      ]);
      const ticketsData = await ticketsRes.json();
      const nftData = nftRes ? await nftRes.json() : null;
      const parts: string[] = [];
      parts.push(
        ticketsRes.ok
          ? ticketsData.issuedNow > 0
            ? `Issued ${ticketsData.issuedNow} ticket(s)`
            : `Tickets OK (${ticketsData.totalTickets})`
          : `Tickets: ${ticketsData.error}`
      );
      if (NFTS_ENABLED && nftRes && nftData) {
        parts.push(nftRes.ok ? `NFT voucher ready` : `NFT: ${nftData.error}`);
      }
      alert(parts.join("\n"));
      onDone();
    } catch (err: any) {
      alert(`Resync failed: ${err.message}`);
    } finally {
      setResyncBusy(false);
    }
  };

  const partySize = booking.guestCount ?? booking.guests?.length ?? 1;
  const extraGuests = (booking.guests || []).slice(1);
  const isPaid = booking.status === "CONFIRMED";
  const totalPaid = isPaid ? (booking.totalPaid ?? booking.paymentAmount) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#2c331f]/40 backdrop-blur-sm" />

      {/* Slide-over panel */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[#f7eedb] border-l-2 border-[#2c331f] shadow-[-8px_0px_0px_0px_#2c331f] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#2c331f] text-[#f7eedb] px-6 py-4 flex items-start justify-between z-10 border-b-2 border-[#2c331f]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Booking Details</p>
            <h2 className="text-lg font-black font-display tracking-tight">{booking.bookingId}</h2>
            <div className="mt-2">
              <StatusBadge status={booking.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#f7eedb]/10 hover:bg-[#f7eedb]/20 transition-colors mt-1"
          >
            <X size={18} strokeWidth={2.5} className="text-[#f7eedb]" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">
          {/* Stay Info */}
          <section className="bg-white rounded-xl border-2 border-[#2c331f] overflow-hidden shadow-[3px_3px_0px_0px_#2c331f]">
            <div className="bg-[#9db47d] px-4 py-2 border-b-2 border-[#2c331f]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#2c331f]">Stay</p>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              <p className="font-black text-[#2c331f]">{booking.stay.title}</p>
              <p className="text-xs font-bold text-[#5a6b3a] flex items-center gap-1">
                <MapPin size={12} /> {booking.stay.location}
              </p>
              {booking.checkInDate && booking.checkOutDate && (
                <p className="text-xs font-bold text-[#2c331f] flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(booking.checkInDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" → "}
                  {new Date(booking.checkOutDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
              {booking.selectedRoomName && (
                <p className="text-xs font-bold text-[#2c331f] flex items-center gap-1">
                  <Bed size={12} /> {booking.selectedRoomName}
                  {booking.numberOfNights ? ` · ${booking.numberOfNights} night${booking.numberOfNights !== 1 ? "s" : ""}` : ""}
                </p>
              )}
              <p className="text-[10px] font-bold text-[#2c331f]/50 uppercase tracking-widest">
                Booked: {new Date(booking.createdAt).toLocaleString()}
              </p>
            </div>
          </section>

          {/* Guest Info */}
          <section className="bg-white rounded-xl border-2 border-[#2c331f] overflow-hidden shadow-[3px_3px_0px_0px_#2c331f]">
            <div className="bg-[#e8c37b] px-4 py-2 border-b-2 border-[#2c331f]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#2c331f]">
                Primary Guest {partySize > 1 && `(+${partySize - 1} more)`}
              </p>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              <p className="font-black text-[#2c331f] text-base">{booking.user.displayName}</p>
              <p className="text-xs font-bold text-[#5a6b3a] flex items-center gap-1">
                <Mail size={12} /> {booking.user.email}
              </p>
              {(booking.user.mobileNumber || booking.guestMobile) && (
                <p className="text-xs font-bold text-[#5a6b3a] flex items-center gap-1">
                  <Smartphone size={12} /> {booking.user.mobileNumber || booking.guestMobile}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {(booking.user.age || booking.guestAge) && (
                  <span className="bg-[#f7eedb] border border-[#2c331f] px-2 py-0.5 rounded text-[10px] font-bold text-[#2c331f]">
                    Age {booking.user.age || booking.guestAge}
                  </span>
                )}
                {(booking.user.gender || booking.guestGender) && (
                  <span className="bg-[#f7eedb] border border-[#2c331f] px-2 py-0.5 rounded text-[10px] font-bold text-[#2c331f]">
                    {booking.user.gender || booking.guestGender}
                  </span>
                )}
                {booking.user.socialTwitter && (
                  <span className="bg-[#f7eedb] border border-[#2c331f] px-2 py-0.5 rounded text-[10px] font-bold text-[#2c331f]">
                    @{booking.user.socialTwitter}
                  </span>
                )}
                {booking.user.socialTelegram && (
                  <span className="bg-[#f7eedb] border border-[#2c331f] px-2 py-0.5 rounded text-[10px] font-bold text-[#2c331f]">
                    tg: {booking.user.socialTelegram}
                  </span>
                )}
              </div>
              {booking.user.walletAddress && (
                <p className="text-[10px] font-bold text-[#2c331f] bg-[#f7eedb] border border-[#2c331f] px-2 py-1 rounded flex items-center gap-1 font-mono mt-1">
                  <Lock size={10} />
                  {booking.user.walletAddress.slice(0, 10)}...{booking.user.walletAddress.slice(-8)}
                </p>
              )}
            </div>
          </section>

          {/* Additional Guests */}
          {extraGuests.length > 0 && (
            <section className="bg-white rounded-xl border-2 border-[#2c331f] overflow-hidden shadow-[3px_3px_0px_0px_#2c331f]">
              <div className="bg-[#f7eedb] px-4 py-2 border-b-2 border-[#2c331f]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#2c331f]">
                  Additional Guests ({extraGuests.length})
                </p>
              </div>
              <div className="divide-y divide-[#2c331f]/10">
                {extraGuests.map((g, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="font-black text-[#2c331f] text-sm">
                      {i + 2}. {g.fullName || "Unnamed guest"}
                    </p>
                    {g.email && <p className="text-[10px] text-[#5a6b3a] font-bold">{g.email}</p>}
                    {g.phone && <p className="text-[10px] text-[#5a6b3a] font-bold">{g.phone}</p>}
                    <p className="text-[10px] text-[#2c331f]/60 uppercase tracking-wider">
                      {[g.gender, g.age && `Age ${g.age}`, g.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Payment Info */}
          <section className="bg-white rounded-xl border-2 border-[#2c331f] overflow-hidden shadow-[3px_3px_0px_0px_#2c331f]">
            <div className="bg-[#2c331f] px-4 py-2 border-b-2 border-[#2c331f]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#f7eedb]">Payment</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              {isPaid && totalPaid ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Total Paid</span>
                    <span className="font-black text-[#2c331f] text-lg">
                      ${totalPaid} {booking.paymentToken}
                    </span>
                  </div>
                  {booking.requiresReservation && booking.reservationAmount && (
                    <div className="bg-[#e8c37b]/20 border border-[#2c331f]/20 rounded-lg p-2.5 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#2c331f]">
                        <span>Reservation</span>
                        <span>${booking.reservationAmount}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#5a6b3a]">
                        <span>Remaining</span>
                        <span>${booking.remainingAmount}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : booking.status === "RESERVED" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Reservation Paid</span>
                    <span className="font-black text-[#2c331f]">${booking.reservationAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Remaining Due</span>
                    <span className="font-black text-[#2c331f]">${booking.remainingAmount}</span>
                  </div>
                  {booking.remainingDueDate && (
                    <p className="text-[10px] font-bold text-[#2c331f]/50 uppercase tracking-widest">
                      Due: {new Date(booking.remainingDueDate).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : booking.selectedRoomPriceUSDC || booking.selectedRoomPriceUSDT ? (
                <div className="space-y-1">
                  {booking.selectedRoomPriceUSDC && (
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">USDC Price</span>
                      <span className="font-black text-[#2c331f]">${booking.selectedRoomPriceUSDC}</span>
                    </div>
                  )}
                  {booking.selectedRoomPriceUSDT && (
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">USDT Price</span>
                      <span className="font-black text-[#2c331f]">${booking.selectedRoomPriceUSDT}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Not yet determined</p>
              )}

              {booking.chainId && (
                <div className="flex items-center gap-1 pt-1">
                  <LinkIcon size={10} className="text-[#5a6b3a]" />
                  <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                    {getBookingChainName(booking.chainId)}
                  </span>
                </div>
              )}

              {booking.txHash && (
                <a
                  href={`${(booking.chainId && chainConfig[booking.chainId]?.blockExplorer) || "https://etherscan.io"}/tx/${booking.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-[#5a6b3a] transition-colors font-mono"
                >
                  <ExternalLink size={10} />
                  {booking.txHash.slice(0, 12)}...{booking.txHash.slice(-8)}
                </a>
              )}

              {booking.expiresAt && new Date(booking.expiresAt) > new Date() && (
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                  Expires: {new Date(booking.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </section>

          {/* Action buttons in modal */}
          <div className="flex flex-col gap-2 pb-2">
            {booking.status === "WAITLISTED" && (
              <ApproveWaitlistButton bookingId={booking.bookingId} onApproved={() => { onClose(); onDone(); }} />
            )}
            {booking.status === "PENDING" && (
              <a
                href={`/booking/${booking.bookingId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-widest text-xs"
              >
                <ExternalLink size={14} />
                Open Payment Page
              </a>
            )}
            {booking.status === "CONFIRMED" && (
              <button
                onClick={handleResync}
                disabled={resyncBusy}
                className="flex items-center justify-center gap-2 w-full py-3 bg-white text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-widest text-xs disabled:opacity-50"
              >
                <RefreshCw size={14} className={resyncBusy ? "animate-spin" : ""} />
                {resyncBusy ? "Syncing…" : NFTS_ENABLED ? "Resync Tickets / NFT" : "Resync Tickets"}
              </button>
            )}
            <div className="flex justify-center">
              <BookingActionsMenu
                bookingId={booking.bookingId}
                status={booking.status}
                onDone={() => { onDone(); }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("WAITLISTED");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStay, setSelectedStay] = useState<string>("ALL");
  const [revenueExpanded, setRevenueExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Stats
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [stayOptions, setStayOptions] = useState<{ id: string; title: string }[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedStay]);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (activeTab !== "ALL") params.set("status", activeTab);
      if (selectedStay !== "ALL") params.set("stayId", selectedStay);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = await res.json();
      setBookings(data.bookings || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, selectedStay, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStay !== "ALL") params.set("stayId", selectedStay);
      const res = await fetch(`/api/admin/stats?${params.toString()}`);
      if (!res.ok) return;
      setStats(await res.json());
    } catch {}
  }, [selectedStay]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stays");
        if (!res.ok) return;
        const data = await res.json();
        setStayOptions((data || []).map((s: any) => ({ id: s.stayId, title: s.title })));
      } catch {}
    })();
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleApproved = () => { fetchBookings(); fetchStats(); };

  // ─── CSV Export ────────────────────────────────────────────────────────────

  const csvCell = (value: unknown) => {
    let s = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const csvTextCell = (value: unknown) => {
    const s = value === null || value === undefined ? "" : String(value);
    if (s === "") return '""';
    return `="${s.replace(/"/g, '""')}"`;
  };

  const exportToCSV = async () => {
    const headers = [
      "Booking ID", "Status", "Guest Name", "Email", "Phone", "Age", "Gender",
      "Party Size", "Additional Guests", "Stay", "Room", "Nights", "Total Paid",
      "Amount Due", "Payment Token", "Chain", "TX Hash", "Wallet Address",
      "Social Twitter", "Social Telegram", "Date",
    ];
    const TEXT_COLUMNS = new Set([0, 4, 16, 17]);
    let exportRows: Booking[] = bookings;
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      if (activeTab !== "ALL") params.set("status", activeTab);
      if (selectedStay !== "ALL") params.set("stayId", selectedStay);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (res.ok) exportRows = (await res.json()).bookings || exportRows;
    } catch {}

    const rows = exportRows.map((b) => {
      const isPaid = b.status === "CONFIRMED";
      const totalPaid = isPaid ? (b.totalPaid ?? b.paymentAmount ?? "") : "";
      const amountDue = isPaid
        ? ""
        : b.status === "RESERVED"
        ? (b.remainingAmount ?? "")
        : (b.paymentAmount ?? "");
      return [
        b.bookingId, b.status, b.user.displayName, b.user.email,
        b.user.mobileNumber || b.guestMobile || "", b.user.age || b.guestAge || "",
        b.user.gender || b.guestGender || "", b.guestCount ?? b.guests?.length ?? 1,
        (b.guests || []).slice(1).map((g) => g.fullName).filter(Boolean).join(" | "),
        b.stay.title, b.selectedRoomName || "Not specified", b.numberOfNights || "",
        totalPaid, amountDue, b.paymentToken || "", getBookingChainName(b.chainId),
        b.txHash || "", b.user.walletAddress || "", b.user.socialTwitter || "",
        b.user.socialTelegram || "", new Date(b.createdAt).toLocaleDateString(),
      ];
    });

    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((row) =>
        row.map((cell, i) => (TEXT_COLUMNS.has(i) ? csvTextCell(cell) : csvCell(cell))).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // ─── Derived state ─────────────────────────────────────────────────────────

  const counts = stats?.counts;
  const tabCounts = {
    waitlisted: counts?.waitlisted ?? 0,
    pending: counts?.pending ?? 0,
    reserved: counts?.reserved ?? 0,
    confirmed: counts?.confirmed ?? 0,
    total: stats?.totalBookings ?? 0,
  };

  const analytics = {
    totalUSDC: stats?.revenue?.USDC ?? 0,
    totalUSDT: stats?.revenue?.USDT ?? 0,
    byChain: stats?.byChain ?? {},
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading && bookings.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7eedb] flex items-center justify-center p-6">
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-10 h-10 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading bookings…</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onDone={() => { fetchBookings(); fetchStats(); }}
        />
      )}

      <div className="min-h-screen bg-[#f7eedb] p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">

          {/* ── Page Header ──────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-[#2c331f] font-display tracking-tight">
                Booking Management
              </h1>
              <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-[10px] mt-1">
                Manage applications, payments &amp; guest information
              </p>
            </div>
            <button
              onClick={exportToCSV}
              className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-none hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-xs"
            >
              <Download size={16} strokeWidth={2.5} />
              Export CSV
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="text-red-600 shrink-0" size={16} />
              <p className="text-red-700 font-bold text-xs">{error}</p>
            </div>
          )}

          {/* ── Compact Stats Strip ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] mb-4 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x-2 divide-y-2 lg:divide-y-0 divide-[#2c331f]">
              {[
                { label: "Pending Approval", count: tabCounts.waitlisted, color: "bg-[#f7eedb]", icon: <Clock size={14} className="text-[#2c331f]" /> },
                { label: "Awaiting Payment", count: tabCounts.pending, color: "bg-[#9db47d]", icon: <DollarSign size={14} className="text-[#2c331f]" /> },
                { label: "Reserved", count: tabCounts.reserved, color: "bg-[#e8c37b]", icon: <Ticket size={14} className="text-[#2c331f]" /> },
                { label: "Confirmed", count: tabCounts.confirmed, color: "bg-[#2c331f]", icon: <CheckCircle size={14} className="text-[#f7eedb]" /> },
                { label: "Total Bookings", count: tabCounts.total, color: "bg-white", icon: <Users size={14} className="text-[#2c331f]" /> },
              ].map(({ label, count, color, icon }) => (
                <div key={label} className={`${color} px-4 py-3 flex items-center justify-between`}>
                  <div>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${color === "bg-[#2c331f]" ? "text-[#f7eedb]/70" : "text-[#5a6b3a]"}`}>
                      {label}
                    </p>
                    <p className={`text-2xl font-black font-display mt-0.5 ${color === "bg-[#2c331f]" ? "text-[#f7eedb]" : "text-[#2c331f]"}`}>
                      {count}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-lg border-2 ${color === "bg-[#2c331f]" ? "border-[#f7eedb]/30 bg-white/10" : "border-[#2c331f] bg-white"} flex items-center justify-center`}>
                    {icon}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Revenue Analytics (collapsible) ──────────────────────────── */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] mb-4 overflow-hidden">
            <button
              onClick={() => setRevenueExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#f7eedb]/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp size={16} className="text-[#2c331f]" strokeWidth={2.5} />
                <span className="font-black text-[#2c331f] text-sm uppercase tracking-widest">Revenue Analytics</span>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                    USDC: <span className="text-[#2c331f]">${analytics.totalUSDC.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                  <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                    USDT: <span className="text-[#2c331f]">${analytics.totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                </div>
              </div>
              {revenueExpanded
                ? <ChevronUp size={16} className="text-[#2c331f]" strokeWidth={2.5} />
                : <ChevronDown size={16} className="text-[#2c331f]" strokeWidth={2.5} />
              }
            </button>

            {revenueExpanded && (
              <div className="border-t-2 border-[#2c331f] px-5 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#9db47d]/20 border-2 border-[#2c331f] rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-1">Total USDC Received</p>
                    <p className="text-2xl font-black text-[#2c331f] font-display">
                      ${analytics.totalUSDC.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-[#e8c37b]/20 border-2 border-[#2c331f] rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-1">Total USDT Received</p>
                    <p className="text-2xl font-black text-[#2c331f] font-display">
                      ${analytics.totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                {Object.entries(analytics.byChain).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-[#2c331f] uppercase tracking-widest">By Chain</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(analytics.byChain).map(([chain, amounts]) => (
                        <div key={chain} className="bg-[#f7eedb] border-2 border-[#2c331f] rounded-lg p-3 flex items-center justify-between">
                          <p className="font-bold text-[#2c331f] text-sm">{chain}</p>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-[#5a6b3a]">
                              USDC: <span className="text-[#2c331f]">${amounts.USDC.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </p>
                            <p className="text-[10px] font-bold text-[#5a6b3a]">
                              USDT: <span className="text-[#2c331f]">${amounts.USDT.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Filters + Tabs ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] mb-4 overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-3 p-4 border-b-2 border-[#2c331f]">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c331f]" size={16} strokeWidth={2.5} />
                <input
                  type="text"
                  placeholder="Search by name, email, booking ID, or wallet…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] placeholder:text-[#5a6b3a] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2c331f] hover:text-red-500 transition-colors"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {/* Stay filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c331f] pointer-events-none" size={14} strokeWidth={2.5} />
                <select
                  value={selectedStay}
                  onChange={(e) => setSelectedStay(e.target.value)}
                  className="appearance-none pl-8 pr-8 py-2.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30 cursor-pointer"
                >
                  <option value="ALL">All Events</option>
                  {stayOptions.map((stay) => (
                    <option key={stay.id} value={stay.id}>{stay.title}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2c331f] pointer-events-none" size={14} strokeWidth={2.5} />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 overflow-x-auto px-4 py-3 custom-scrollbar">
              {(["WAITLISTED", "PENDING", "RESERVED", "CONFIRMED", "ALL"] as TabType[]).map((tab) => {
                const count = tab === "ALL" ? tabCounts.total : tabCounts[tab.toLowerCase() as keyof typeof tabCounts];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 font-bold uppercase tracking-widest text-[10px] transition-all rounded-lg border-2 ${
                      activeTab === tab
                        ? "bg-[#2c331f] text-[#f7eedb] border-[#2c331f] shadow-[2px_2px_0px_0px_#9db47d]"
                        : "bg-[#f7eedb] text-[#5a6b3a] border-[#2c331f]/30 hover:border-[#2c331f] hover:text-[#2c331f]"
                    }`}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${
                      activeTab === tab ? "bg-[#9db47d] text-[#2c331f] border-[#9db47d]" : "bg-white text-[#2c331f] border-[#2c331f]/20"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Count label */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
              Showing {bookings.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + bookings.length} of {total} bookings
            </p>
            {loading && (
              <div className="w-4 h-4 border-2 border-[#2c331f]/20 border-t-[#2c331f] rounded-full animate-spin" />
            )}
          </div>

          {/* ── Bookings Table ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2c331f]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Booking</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Guest</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Room / Dates</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Payment</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#2c331f]/10">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <div className="w-7 h-7 border-4 border-[#2c331f]/20 border-t-[#2c331f] rounded-full animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                        No bookings found
                      </td>
                    </tr>
                  ) : (
                    bookings.map((booking) => {
                      const isPaid = booking.status === "CONFIRMED";
                      const totalPaid = isPaid ? (booking.totalPaid ?? booking.paymentAmount) : null;
                      const partySize = booking.guestCount ?? booking.guests?.length ?? 1;

                      return (
                        <tr
                          key={booking.bookingId}
                          className="hover:bg-[#f7eedb]/40 transition-colors"
                        >
                          {/* Booking */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="bg-[#f7eedb] px-1.5 py-0.5 rounded border-2 border-[#2c331f] text-[#2c331f] font-bold text-[9px] w-fit tracking-wider">
                                {booking.bookingId}
                              </p>
                              <p className="font-black text-[#2c331f] text-sm leading-tight max-w-[180px]">
                                {booking.stay.title}
                              </p>
                              <p className="text-[10px] font-bold text-[#5a6b3a] flex items-center gap-0.5">
                                <MapPin size={10} /> {booking.stay.location}
                              </p>
                              <p className="text-[9px] font-bold text-[#2c331f]/40 uppercase tracking-widest">
                                {new Date(booking.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </td>

                          {/* Guest */}
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              <p className="font-black text-[#2c331f] text-sm">
                                {booking.user.displayName}
                                {partySize > 1 && (
                                  <span className="ml-1 text-[9px] font-bold bg-[#9db47d] border border-[#2c331f] px-1 py-0.5 rounded text-[#2c331f]">
                                    +{partySize - 1}
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] font-bold text-[#5a6b3a] flex items-center gap-0.5">
                                <Mail size={10} /> {booking.user.email}
                              </p>
                              {(booking.user.mobileNumber || booking.guestMobile) && (
                                <p className="text-[10px] font-bold text-[#5a6b3a] flex items-center gap-0.5">
                                  <Smartphone size={10} /> {booking.user.mobileNumber || booking.guestMobile}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Room / Dates */}
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {booking.selectedRoomName ? (
                                <p className="font-black text-[#2c331f] text-xs flex items-center gap-1">
                                  <Bed size={11} /> {booking.selectedRoomName}
                                </p>
                              ) : (
                                <p className="text-[10px] font-bold text-[#5a6b3a]">No preference</p>
                              )}
                              {booking.numberOfNights && (
                                <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                                  {booking.numberOfNights} night{booking.numberOfNights !== 1 ? "s" : ""}
                                </p>
                              )}
                              {booking.checkInDate && booking.checkOutDate && (
                                <p className="text-[10px] font-bold text-[#2c331f] flex items-center gap-0.5">
                                  <Calendar size={10} />
                                  {new Date(booking.checkInDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  {" – "}
                                  {new Date(booking.checkOutDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Payment */}
                          <td className="px-4 py-3">
                            {isPaid && totalPaid ? (
                              <div className="space-y-0.5">
                                <p className="font-black text-[#2c331f] text-sm">
                                  ${totalPaid} <span className="text-[10px] font-bold">{booking.paymentToken}</span>
                                </p>
                                {booking.chainId && (
                                  <p className="text-[10px] font-bold text-[#5a6b3a] flex items-center gap-0.5">
                                    <LinkIcon size={9} /> {getBookingChainName(booking.chainId)}
                                  </p>
                                )}
                                {booking.txHash && (
                                  <a
                                    href={`${(booking.chainId && chainConfig[booking.chainId]?.blockExplorer) || "https://etherscan.io"}/tx/${booking.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] font-bold text-blue-600 hover:text-[#5a6b3a] font-mono"
                                  >
                                    {booking.txHash.slice(0, 8)}…{booking.txHash.slice(-4)}
                                  </a>
                                )}
                              </div>
                            ) : booking.status === "RESERVED" ? (
                              <div className="space-y-0.5">
                                <p className="text-xs font-black text-[#2c331f]">Res: ${booking.reservationAmount}</p>
                                <p className="text-[10px] font-bold text-[#5a6b3a]">Due: ${booking.remainingAmount}</p>
                              </div>
                            ) : booking.selectedRoomPriceUSDC || booking.selectedRoomPriceUSDT ? (
                              <div className="space-y-0.5">
                                {booking.selectedRoomPriceUSDC && (
                                  <p className="text-xs font-black text-[#2c331f]">${booking.selectedRoomPriceUSDC} USDC</p>
                                )}
                                {booking.selectedRoomPriceUSDT && (
                                  <p className="text-[10px] font-bold text-[#5a6b3a]">${booking.selectedRoomPriceUSDT} USDT</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] font-bold text-[#5a6b3a]">—</p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge status={booking.status} />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => setSelectedBooking(booking)}
                                title="View Details"
                                className="p-1.5 rounded-lg border-2 border-[#2c331f] bg-[#f7eedb] text-[#2c331f] hover:bg-[#2c331f] hover:text-[#f7eedb] transition-colors"
                              >
                                <Eye size={14} strokeWidth={2} />
                              </button>

                              {/* Quick approve for waitlisted */}
                              {booking.status === "WAITLISTED" && (
                                <ApproveWaitlistButton
                                  bookingId={booking.bookingId}
                                  onApproved={handleApproved}
                                />
                              )}

                              {/* 3-dot menu */}
                              <BookingActionsMenu
                                bookingId={booking.bookingId}
                                status={booking.status}
                                onDone={() => { fetchBookings(); fetchStats(); }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between bg-white rounded-2xl p-4 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
              <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-4 py-2 bg-white text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-none hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-[10px] disabled:opacity-40 disabled:pointer-events-none"
                >
                  ← Prev
                </button>
                <span className="px-4 py-2 bg-[#2c331f] text-[#f7eedb] rounded-xl border-2 border-[#2c331f] font-black text-xs">
                  {page}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-4 py-2 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-none hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-[10px] disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
