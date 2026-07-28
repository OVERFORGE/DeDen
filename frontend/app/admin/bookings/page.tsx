// File: app/admin/bookings/page.tsx
// ✅ UPDATED: Added RESERVED tab and reservation payment breakdown

"use client";

import { useState, useEffect, useCallback } from "react";
import { ApproveWaitlistButton } from "@/components/ApproveWaitlistButton";
import { BookingActionsMenu } from "@/components/admin/BookingActionsMenu";
import { chainConfig, getChainName } from "@/lib/config";
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
  X,
  Calendar,
  Ticket,
  MapPin,
  Mail,
  Smartphone,
  Lock,
  Bed,
  Link as LinkIcon,
  RefreshCw
} from "lucide-react";

// Types
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
  
  // ✅ NEW: Reservation fields
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

// Helper function
// Wraps the shared, always-up-to-date chain registry (lib/config.ts) —
// this used to be a local hardcoded list that went stale the moment the
// supported chain set changed (it still said "Arbitrum" after Arbitrum was
// briefly removed, and didn't know about newer chains at all).
const getBookingChainName = (chainId?: number): string => {
  return chainId ? getChainName(chainId) : 'Unknown';
};

const PAGE_SIZE = 25;

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("WAITLISTED");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStay, setSelectedStay] = useState<string>("ALL");
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);

  // Server-driven pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Server-computed stats (replaces filtering the whole booking list in the browser)
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [stayOptions, setStayOptions] = useState<{ id: string; title: string }[]>([]);

  // Debounce search so we don't fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to page 1 whenever a filter changes
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
      if (!res.ok) {
        throw new Error('Failed to fetch bookings');
      }
      const data = await res.json();
      setBookings(data.bookings || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching bookings:', err);
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
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [selectedStay]);

  // Stay dropdown options come from the stays endpoint rather than being
  // derived from the current page of bookings (which would only ever list
  // stays that happen to appear on that page).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/stays');
        if (!res.ok) return;
        const data = await res.json();
        setStayOptions(
          (data || []).map((s: any) => ({ id: s.stayId, title: s.title }))
        );
      } catch (err) {
        console.error('Error fetching stays:', err);
      }
    })();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleApproved = () => {
    fetchBookings();
    fetchStats();
  };

  const [resyncingId, setResyncingId] = useState<string | null>(null);

  // Issues any missing tickets and retries a failed NFT mint for a CONFIRMED
  // booking. Needed for bookings CONFIRMED before the ticket system existed
  // (they were never issued any) or where the NFT mint failed silently.
  const handleResync = async (bookingId: string) => {
    setResyncingId(bookingId);
    try {
      const [ticketsRes, nftRes] = await Promise.all([
        fetch(`/api/admin/bookings/${bookingId}/backfill-tickets`, { method: 'POST' }),
        fetch(`/api/admin/bookings/${bookingId}/retry-nft`, { method: 'POST' }),
      ]);

      const ticketsData = await ticketsRes.json();
      const nftData = await nftRes.json();

      const parts: string[] = [];
      if (ticketsRes.ok) {
        parts.push(
          ticketsData.issuedNow > 0
            ? `Issued ${ticketsData.issuedNow} ticket(s)`
            : `Tickets already up to date (${ticketsData.totalTickets})`
        );
      } else {
        parts.push(`Tickets: ${ticketsData.error}`);
      }

      // NFT retry can legitimately fail (already minted, missing sender
      // address on very old bookings) — that's not an error worth alarming
      // the admin over, just report it.
      parts.push(nftRes.ok ? `NFT minted (token #${nftData.tokenId})` : `NFT: ${nftData.error}`);

      alert(parts.join('\n'));
      fetchBookings();
    } catch (err: any) {
      alert(`Resync failed: ${err.message}`);
    } finally {
      setResyncingId(null);
    }
  };

  const uniqueStays = stayOptions;

  // Filtering now happens server-side, so the current page is already the
  // filtered result set.
  const filteredBookings = bookings;

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

  // ✅ UPDATED: Added RESERVED status and Neo-Brutalist styles
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string; icon: any }> = {
      WAITLISTED: { bg: 'bg-[#f7eedb]', text: 'text-[#2c331f]', label: 'Waitlisted', icon: <Clock size={12} className="mr-1 inline" /> },
      PENDING: { bg: 'bg-[#9db47d]', text: 'text-[#2c331f]', label: 'Pending Payment', icon: <DollarSign size={12} className="mr-1 inline" /> },
      RESERVED: { bg: 'bg-[#e8c37b]', text: 'text-[#2c331f]', label: 'Reserved', icon: <Ticket size={12} className="mr-1 inline" /> },
      CONFIRMED: { bg: 'bg-[#2c331f]', text: 'text-[#f7eedb]', label: 'Confirmed', icon: <CheckCircle size={12} className="mr-1 inline" /> },
      CANCELLED: { bg: 'bg-red-500', text: 'text-white', label: 'Cancelled', icon: <X size={12} className="mr-1 inline" /> },
      EXPIRED: { bg: 'bg-gray-300', text: 'text-gray-800', label: 'Expired', icon: <Clock size={12} className="mr-1 inline" /> },
      FAILED: { bg: 'bg-red-500', text: 'text-white', label: 'Failed', icon: <AlertCircle size={12} className="mr-1 inline" /> },
    };

    const style = styles[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status, icon: null };
    
    return (
      <span className={`${style.bg} ${style.text} px-3 py-1.5 rounded-md border-2 border-[#2c331f] text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#2c331f] inline-flex items-center`}>
        {style.icon} {style.label}
      </span>
    );
  };

  // CSV values are quote-escaped — guest names, room names and social
  // handles can legitimately contain commas, which previously corrupted
  // every column after them.
  //
  // Also neutralises CSV/formula injection: guest names are user-supplied,
  // and a value starting with = + - @ is executed as a formula when the
  // export is opened in Excel/Sheets. Prefixing with an apostrophe forces
  // it to be read as text.
  const csvCell = (value: unknown) => {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  // For identifiers (phone, wallet, tx hash, booking id). Excel coerces long
  // digit strings into scientific notation — a 12-digit phone number came
  // out as "9.198E+11", i.e. unusable. The ="..." form pins it as text.
  const csvTextCell = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    if (s === '') return '""';
    return `="${s.replace(/"/g, '""')}"`;
  };

  const exportToCSV = async () => {
    const headers = [
      'Booking ID',
      'Status',
      'Guest Name',
      'Email',
      'Phone',
      'Age',
      'Gender',
      'Party Size',
      'Additional Guests',
      'Stay',
      'Room',
      'Nights',
      'Total Paid',
      'Amount Due',
      'Payment Token',
      'Chain',
      'TX Hash',
      'Wallet Address',
      'Social Twitter',
      'Social Telegram',
      'Date'
    ];

    // Identifier columns Excel would otherwise mangle into scientific notation.
    const TEXT_COLUMNS = new Set([0, 4, 16, 17]);

    // Export every row matching the current filters, not just the page
    // currently on screen.
    let exportRows: Booking[] = filteredBookings;
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '200' });
      if (activeTab !== 'ALL') params.set('status', activeTab);
      if (selectedStay !== 'ALL') params.set('stayId', selectedStay);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        exportRows = data.bookings || exportRows;
      }
    } catch {
      // Fall back to the on-screen page if the bulk fetch fails.
    }

    const rows = exportRows.map(b => {
      // Only a CONFIRMED booking has actually been paid. Previously this
      // column fell back to `paymentAmount` (the last *locked* leg), so an
      // unpaid PENDING booking showed a figure under "Total Paid".
      const isPaid = b.status === 'CONFIRMED';
      const totalPaid = isPaid ? (b.totalPaid ?? b.paymentAmount ?? '') : '';
      const amountDue = isPaid
        ? ''
        : b.status === 'RESERVED'
          ? (b.remainingAmount ?? '')
          : (b.paymentAmount ?? '');

      return [
        b.bookingId,
        b.status,
        b.user.displayName,
        b.user.email,
        b.user.mobileNumber || b.guestMobile || '',
        b.user.age || b.guestAge || '',
        b.user.gender || b.guestGender || '',
        b.guestCount ?? b.guests?.length ?? 1,
        (b.guests || []).slice(1).map(g => g.fullName).filter(Boolean).join(' | '),
        b.stay.title,
        b.selectedRoomName || 'Not specified',
        b.numberOfNights || '',
        totalPaid,
        amountDue,
        b.paymentToken || '',
        getBookingChainName(b.chainId),
        b.txHash || '',
        b.user.walletAddress || '',
        b.user.socialTwitter || '',
        b.user.socialTelegram || '',
        new Date(b.createdAt).toLocaleDateString()
      ];
    });

    const csv = [
      headers.map(csvCell).join(','),
      ...rows.map(row =>
        row.map((cell, i) => (TEXT_COLUMNS.has(i) ? csvTextCell(cell) : csvCell(cell))).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7eedb] flex items-center justify-center p-6">
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-5"></div>
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-2 text-[#2c331f] font-display tracking-tight">
            Booking Management
          </h1>
          <p className="text-[#5a6b3a] font-bold uppercase tracking-widest text-xs">
            Manage applications, payments, and guest information
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#f7eedb] rounded-xl flex items-center justify-center border-2 border-[#2c331f]">
                <Clock className="text-[#2c331f]" size={24} strokeWidth={2.5} />
              </div>
              <span className="text-3xl font-black text-[#2c331f] font-display">
                {tabCounts.waitlisted}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Pending Approval</p>
          </div>

          <div className="bg-[#9db47d] rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border-2 border-[#2c331f]">
                <DollarSign className="text-[#2c331f]" size={24} strokeWidth={2.5} />
              </div>
              <span className="text-3xl font-black text-[#2c331f] font-display">
                {tabCounts.pending}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#2c331f]/80 uppercase tracking-widest">Awaiting Payment</p>
          </div>

          {/* RESERVED Stats Card */}
          <div className="bg-[#e8c37b] rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border-2 border-[#2c331f]">
                <Ticket className="text-[#2c331f]" size={24} strokeWidth={2.5} />
              </div>
              <span className="text-3xl font-black text-[#2c331f] font-display">
                {tabCounts.reserved}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#2c331f]/80 uppercase tracking-widest">Reserved</p>
          </div>

          <div className="bg-[#2c331f] rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#9db47d]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border-2 border-[#f7eedb]/30">
                <CheckCircle className="text-[#f7eedb]" size={24} strokeWidth={2.5} />
              </div>
              <span className="text-3xl font-black text-[#f7eedb] font-display">
                {tabCounts.confirmed}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#f7eedb]/70 uppercase tracking-widest">Confirmed</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-[#2c331f]">
                <Users className="text-[#2c331f]" size={24} strokeWidth={2.5} />
              </div>
              <span className="text-3xl font-black text-[#2c331f] font-display">
                {tabCounts.total}
              </span>
            </div>
            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">Total Bookings</p>
          </div>
        </div>

        {/* Revenue Analytics */}
        <div className="bg-white rounded-2xl p-6 mb-8 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <h2 className="text-xl font-black text-[#2c331f] font-display tracking-tight mb-6">Revenue Analytics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-[#9db47d]/20 border-2 border-[#2c331f] rounded-xl p-4">
              <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-1">Total USDC Received</p>
              <p className="text-3xl font-black text-[#2c331f] font-display">
                ${analytics.totalUSDC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-[#e8c37b]/20 border-2 border-[#2c331f] rounded-xl p-4">
              <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-1">Total USDT Received</p>
              <p className="text-3xl font-black text-[#2c331f] font-display">
                ${analytics.totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#2c331f] uppercase tracking-widest">By Chain</h3>
            {Object.entries(analytics.byChain).map(([chain, amounts]) => (
              <div key={chain} className="bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl p-4">
                <p className="font-bold text-[#2c331f] mb-3">{chain}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">USDC</p>
                    <p className="text-lg font-black text-[#2c331f]">
                      ${amounts.USDC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">USDT</p>
                    <p className="text-lg font-black text-[#2c331f]">
                      ${amounts.USDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2c331f]" size={20} strokeWidth={2.5} />
                <input
                  type="text"
                  placeholder="Search by name, email, booking ID, or wallet..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] placeholder:text-[#5a6b3a] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2c331f] hover:text-red-500 transition-colors"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <select
                value={selectedStay}
                onChange={(e) => setSelectedStay(e.target.value)}
                className="appearance-none pl-4 pr-12 py-3.5 border-2 border-[#2c331f] rounded-xl bg-[#f7eedb] text-[#2c331f] font-bold text-sm focus:outline-none focus:ring-4 focus:ring-[#9db47d]/30"
              >
                <option value="ALL">All Events</option>
                {uniqueStays.map(stay => (
                  <option key={stay.id} value={stay.id}>
                    {stay.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2c331f] pointer-events-none" size={20} strokeWidth={2.5} />
            </div>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-sm"
            >
              <Download size={20} strokeWidth={2.5} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {(['WAITLISTED', 'PENDING', 'RESERVED', 'CONFIRMED', 'ALL'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-5 py-2.5 font-bold uppercase tracking-widest text-[10px] transition-all rounded-xl border-2 ${
                  activeTab === tab
                    ? 'bg-[#2c331f] text-[#f7eedb] border-[#2c331f] shadow-[3px_3px_0px_0px_#9db47d]'
                    : 'bg-white text-[#5a6b3a] border-[#2c331f] hover:bg-[#f7eedb]'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                <span className={`ml-2 px-2 py-0.5 rounded-md border-2 border-[#2c331f] text-[10px] ${
                  activeTab === tab ? 'bg-[#9db47d] text-[#2c331f]' : 'bg-[#f7eedb] text-[#2c331f]'
                }`}>
                  {tab === 'ALL' ? tabCounts.total : tabCounts[tab.toLowerCase() as keyof typeof tabCounts]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
          Showing {filteredBookings.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          –{(page - 1) * PAGE_SIZE + filteredBookings.length} of {total} bookings
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#2c331f] border-b-2 border-[#2c331f]">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">
                    Booking Details
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">
                    Guest Info
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">
                    Room & Pricing
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">
                    Payment Details
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#f7eedb] uppercase tracking-widest">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#2c331f]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 border-4 border-[#2c331f]/20 border-t-[#2c331f] rounded-full animate-spin"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                      No bookings found
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => (
                    <tr key={booking.bookingId} className="hover:bg-[#f7eedb]/30 transition-colors">
                      {/* Booking Details */}
                      <td className="px-6 py-5">
                        <div className="space-y-1.5">
                          <p className="bg-[#f7eedb] px-2 py-1 rounded-md border-2 border-[#2c331f] text-[#2c331f] font-bold text-[10px] w-fit">
                            {booking.bookingId}
                          </p>
                          <p className="font-black text-[#2c331f] text-base">
                            {booking.stay.title}
                          </p>
                          <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest flex items-center">
                            <MapPin size={12} className="mr-1" /> {booking.stay.location}
                          </p>
                          
                          {booking.checkInDate && booking.checkOutDate && (
                            <div className="text-[10px] font-bold text-[#2c331f] mt-2">
                              <div className="flex items-center gap-1">
                                <Calendar size={12} />
                                <span>
                                  {new Date(booking.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(booking.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          <p className="text-[10px] font-bold text-[#2c331f]/50 uppercase tracking-widest">
                            {new Date(booking.createdAt).toLocaleDateString()} at{' '}
                            {new Date(booking.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>

                      {/* Guest Info */}
                      <td className="px-6 py-5">
                        <div className="space-y-1.5">
                          <p className="font-black text-[#2c331f]">
                            {booking.user.displayName}
                          </p>
                          <p className="text-xs font-bold text-[#5a6b3a] flex items-center">
                            <Mail size={12} className="mr-1" /> {booking.user.email}
                          </p>
                          {(booking.user.mobileNumber || booking.guestMobile) && (
                            <p className="text-xs font-bold text-[#5a6b3a] flex items-center">
                              <Smartphone size={12} className="mr-1" /> {booking.user.mobileNumber || booking.guestMobile}
                            </p>
                          )}
                          {(booking.user.age || booking.guestAge) && (
                            <p className="text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest">
                              Age: {booking.user.age || booking.guestAge}
                            </p>
                          )}
                          {(booking.user.gender || booking.guestGender) && (
                            <p className="text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest">
                              Gender: {booking.user.gender || booking.guestGender}
                            </p>
                          )}
                          {booking.user.walletAddress && (
                            <p className="text-[10px] font-bold text-[#2c331f] bg-[#f7eedb] border border-[#2c331f] px-2 py-0.5 rounded-md w-fit flex items-center">
                              <Lock size={10} className="mr-1" /> {booking.user.walletAddress.slice(0, 6)}...{booking.user.walletAddress.slice(-4)}
                            </p>
                          )}

                          {/* Party size + secondary guests. Multi-guest bookings
                              are supported end-to-end in the backend, but this
                              table previously only ever showed the primary
                              contact — admin had no way to see who else was
                              coming, or even how many. */}
                          {(() => {
                            const partySize = booking.guestCount ?? booking.guests?.length ?? 1;
                            if (partySize <= 1) return null;
                            const isOpen = expandedBooking === booking.bookingId;
                            const extraGuests = (booking.guests || []).slice(1);

                            return (
                              <div className="pt-1.5">
                                <button
                                  onClick={() => setExpandedBooking(isOpen ? null : booking.bookingId)}
                                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#2c331f] bg-[#9db47d] border-2 border-[#2c331f] px-2 py-1 rounded-md hover:bg-[#8ba36c] transition-colors"
                                >
                                  <Users size={11} strokeWidth={2.5} />
                                  {partySize} Guests
                                  <ChevronDown
                                    size={11}
                                    strokeWidth={3}
                                    className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                  />
                                </button>

                                {isOpen && (
                                  <div className="mt-2 space-y-2 bg-[#f7eedb] border-2 border-[#2c331f] rounded-lg p-2.5 max-w-[260px]">
                                    {extraGuests.length === 0 ? (
                                      <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                                        No additional guest details recorded
                                      </p>
                                    ) : (
                                      extraGuests.map((g, i) => (
                                        <div
                                          key={i}
                                          className="text-[10px] font-bold text-[#2c331f] border-b border-[#2c331f]/15 last:border-0 pb-1.5 last:pb-0"
                                        >
                                          <p className="font-black text-xs">
                                            {i + 2}. {g.fullName || 'Unnamed guest'}
                                          </p>
                                          {g.email && <p className="opacity-70 break-all">{g.email}</p>}
                                          {g.phone && <p className="opacity-70">{g.phone}</p>}
                                          <p className="opacity-60 uppercase tracking-wider">
                                            {[g.gender, g.age && `Age ${g.age}`, g.country]
                                              .filter(Boolean)
                                              .join(' · ')}
                                          </p>
                                          {(g.xHandle || g.telegram) && (
                                            <p className="opacity-60">
                                              {[g.xHandle, g.telegram].filter(Boolean).join(' · ')}
                                            </p>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Room & Pricing */}
                      <td className="px-6 py-5">
                        <div className="space-y-1.5">
                          {booking.selectedRoomName ? (
                            <>
                              <p className="font-black text-[#2c331f] flex items-center text-sm">
                                <Bed size={14} className="mr-1.5" /> {booking.selectedRoomName}
                              </p>
                              {booking.numberOfNights && (
                                <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                                  {booking.numberOfNights} night{booking.numberOfNights !== 1 ? 's' : ''}
                                </p>
                              )}
                              {booking.pricePerNightUSDC && (
                                <p className="text-xs font-bold text-[#2c331f]">
                                  ${booking.pricePerNightUSDC}/night USDC
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                              No room preference
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Payment Details with reservation breakdown */}
                      <td className="px-6 py-5">
                        {booking.status === 'CONFIRMED' && (booking.totalPaid ?? booking.paymentAmount) ? (
                          <div className="space-y-1.5">
                            {/* Headline must be the TOTAL paid. `paymentAmount`
                                only ever holds the most recently locked leg
                                (i.e. the remaining payment on a reservation
                                booking), so using it here contradicted the
                                breakdown box directly below. */}
                            <p className="font-black text-lg text-[#2c331f]">
                              ${booking.totalPaid ?? booking.paymentAmount} {booking.paymentToken}
                            </p>

                            {booking.requiresReservation && booking.reservationAmount && (
                              <div className="text-[10px] font-bold text-[#2c331f] mt-2 space-y-1 bg-[#e8c37b]/20 border border-[#2c331f] p-2 rounded-md uppercase tracking-widest">
                                <p className="text-[#5a6b3a]">Payment Breakdown:</p>
                                <p>Reservation: ${booking.reservationAmount}</p>
                                <p>Remaining: ${booking.remainingAmount}</p>
                              </div>
                            )}
                            
                            {booking.chainId && (
                              <p className="text-[10px] font-bold text-[#2c331f] flex items-center uppercase tracking-widest">
                                <LinkIcon size={10} className="mr-1" /> {getBookingChainName(booking.chainId)}
                              </p>
                            )}
                            {booking.txHash && (
                              <a
                                href={`${(booking.chainId && chainConfig[booking.chainId]?.blockExplorer) || 'https://etherscan.io'}/tx/${booking.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold text-blue-600 hover:text-[#5a6b3a] underline font-mono block truncate max-w-[150px]"
                                title={booking.txHash}
                              >
                                {booking.txHash.slice(0, 8)}...{booking.txHash.slice(-6)}
                              </a>
                            )}
                          </div>
                        ) : booking.status === 'RESERVED' ? (
                          <div className="space-y-1.5">
                            <p className="font-black text-[#2c331f]">
                              Res. Paid: ${booking.reservationAmount}
                            </p>
                            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                              Remaining: ${booking.remainingAmount} (due on check-in)
                            </p>
                            {booking.remainingDueDate && (
                              <p className="text-[10px] font-bold text-[#2c331f]/70 uppercase tracking-widest">
                                Due: {new Date(booking.remainingDueDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : booking.selectedRoomPriceUSDC || booking.selectedRoomPriceUSDT ? (
                          <div className="space-y-1.5">
                            {booking.selectedRoomPriceUSDC && (
                              <p className="text-xs font-black text-[#2c331f]">
                                ${booking.selectedRoomPriceUSDC} USDC
                              </p>
                            )}
                            {booking.selectedRoomPriceUSDT && (
                              <p className="text-xs font-black text-[#2c331f]">
                                ${booking.selectedRoomPriceUSDT} USDT
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                            Not yet determined
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        {getStatusBadge(booking.status)}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-5">
                        <div className="flex items-start gap-2">
                        <div className="flex-1">
                        {booking.status === 'WAITLISTED' ? (
                          <ApproveWaitlistButton 
                            bookingId={booking.bookingId}
                            onApproved={handleApproved}
                          />
                        ) : booking.status === 'PENDING' ? (
                          <div className="space-y-2">
                            <a 
                              href={`/booking/${booking.bookingId}`}
                              target="_blank"
                              className="text-[10px] font-bold text-[#2c331f] hover:text-[#5a6b3a] uppercase tracking-widest underline"
                            >
                              View Payment →
                            </a>
                            {booking.expiresAt && new Date(booking.expiresAt) > new Date() && (
                              <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                                Expires: {new Date(booking.expiresAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ) : booking.status === 'RESERVED' ? (
                          <div className="space-y-2">
                            <span className="text-[#2c331f] font-black text-xs block flex items-center">
                              <Ticket size={12} className="mr-1" /> Reserved
                            </span>
                            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                              Awaiting remaining
                            </p>
                          </div>
                        ) : booking.status === 'CONFIRMED' ? (
                          <div className="space-y-2">
                            <span className="text-[#2c331f] font-black text-xs flex items-center">
                              <CheckCircle size={12} className="mr-1" /> Paid
                            </span>
                            <button
                              onClick={() => handleResync(booking.bookingId)}
                              disabled={resyncingId === booking.bookingId}
                              title="Issue any missing tickets and retry a failed NFT mint"
                              className="flex items-center gap-1 text-[10px] font-bold text-[#5a6b3a] hover:text-[#2c331f] uppercase tracking-widest underline disabled:opacity-50"
                            >
                              <RefreshCw size={10} className={resyncingId === booking.bookingId ? 'animate-spin' : ''} />
                              {resyncingId === booking.bookingId ? 'Syncing...' : 'Resync Tickets/NFT'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#2c331f]/50 text-sm font-bold">—</span>
                        )}
                        </div>
                        <BookingActionsMenu
                          bookingId={booking.bookingId}
                          status={booking.status}
                          onDone={() => { fetchBookings(); fetchStats(); }}
                        />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl p-4 border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
            <p className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
              Page {page} of {totalPages}
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-4 py-2.5 bg-white text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-[10px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_#2c331f] disabled:hover:translate-y-0 disabled:hover:translate-x-0"
              >
                ← Prev
              </button>

              <span className="px-4 py-2.5 bg-[#2c331f] text-[#f7eedb] rounded-xl border-2 border-[#2c331f] font-black text-xs">
                {page}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-4 py-2.5 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-wider text-[10px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_#2c331f] disabled:hover:translate-y-0 disabled:hover:translate-x-0"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}