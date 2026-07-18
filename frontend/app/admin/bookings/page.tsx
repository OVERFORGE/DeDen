// File: app/admin/bookings/page.tsx
// ✅ UPDATED: Added RESERVED tab and reservation payment breakdown

"use client";

import { useState, useEffect } from "react";
import { ApproveWaitlistButton } from "@/components/ApproveWaitlistButton";
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
  Link as LinkIcon
} from "lucide-react";

// Types
type Booking = {
  id: string;
  bookingId: string;
  status: string;
  guestName: string;
  guestEmail: string;
  guestGender?: string;
  guestAge?: number;
  guestMobile?: string;
  paymentAmount?: number;
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

// Helper function
const getChainName = (chainId?: number): string => {
  const chains: Record<number, string> = {
    42161: 'Arbitrum',
    56: 'BNB Chain',
    8453: 'Base',
  };
  return chainId ? (chains[chainId] || `Chain ${chainId}`) : 'Unknown';
};

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("WAITLISTED");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStay, setSelectedStay] = useState<string>("ALL");

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/admin/bookings');
      if (!res.ok) {
        throw new Error('Failed to fetch bookings');
      }
      const data = await res.json();
      setBookings(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleApproved = () => {
    fetchBookings();
  };

  const uniqueStays = Array.from(
    new Set(bookings.map(b => b.stay.stayId))
  ).map(stayId => {
    const booking = bookings.find(b => b.stay.stayId === stayId);
    return {
      id: stayId,
      title: booking?.stay.title || stayId
    };
  });

  const filteredBookings = bookings.filter(booking => {
    const matchesTab = 
      activeTab === "ALL" || 
      booking.status === activeTab;
    
    const matchesSearch = 
      booking.guestName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.guestEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.user.walletAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStay = selectedStay === "ALL" || booking.stay.stayId === selectedStay;
    
    return matchesTab && matchesSearch && matchesStay;
  });

  // ✅ UPDATED: Added RESERVED to stats
  const stats = {
    waitlisted: bookings.filter(b => b.status === 'WAITLISTED').length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    reserved: bookings.filter(b => b.status === 'RESERVED').length, // ✅ NEW
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    total: bookings.length,
  };

  const analytics = {
    totalUSDC: bookings
      .filter(b => b.status === 'CONFIRMED' && b.paymentToken === 'USDC')
      .reduce((sum, b) => sum + (b.paymentAmount || 0), 0),
    totalUSDT: bookings
      .filter(b => b.status === 'CONFIRMED' && b.paymentToken === 'USDT')
      .reduce((sum, b) => sum + (b.paymentAmount || 0), 0),
    byChain: bookings
      .filter(b => b.status === 'CONFIRMED')
      .reduce((acc, b) => {
        const chain = getChainName(b.chainId);
        if (!acc[chain]) {
          acc[chain] = { USDC: 0, USDT: 0 };
        }
        if (b.paymentToken === 'USDC') {
          acc[chain].USDC += b.paymentAmount || 0;
        } else if (b.paymentToken === 'USDT') {
          acc[chain].USDT += b.paymentAmount || 0;
        }
        return acc;
      }, {} as Record<string, { USDC: number; USDT: number }>),
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

  const exportToCSV = () => {
    const headers = [
      'Booking ID',
      'Status',
      'Guest Name',
      'Email',
      'Phone',
      'Age',
      'Gender',
      'Stay',
      'Room',
      'Nights',
      'Payment Amount',
      'Payment Token',
      'Chain',
      'TX Hash',
      'Wallet Address',
      'Social Twitter',
      'Social Telegram',
      'Date'
    ];

    const rows = filteredBookings.map(b => [
      b.bookingId,
      b.status,
      b.user.displayName,
      b.user.email,
      b.user.mobileNumber || b.guestMobile || '',
      b.user.age || b.guestAge || '',
      b.user.gender || b.guestGender || '',
      b.stay.title,
      b.selectedRoomName || 'Not specified',
      b.numberOfNights || '',
      b.paymentAmount || '',
      b.paymentToken || '',
      getChainName(b.chainId),
      b.txHash || '',
      b.user.walletAddress || '',
      b.user.socialTwitter || '',
      b.user.socialTelegram || '',
      new Date(b.createdAt).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
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
                {stats.waitlisted}
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
                {stats.pending}
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
                {stats.reserved}
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
                {stats.confirmed}
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
                {stats.total}
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
                  {tab === 'ALL' ? stats.total : stats[tab.toLowerCase() as keyof typeof stats]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
          Showing {filteredBookings.length} of {bookings.length} bookings
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
                        {booking.status === 'CONFIRMED' && booking.paymentAmount ? (
                          <div className="space-y-1.5">
                            <p className="font-black text-lg text-[#2c331f]">
                              ${booking.paymentAmount} {booking.paymentToken}
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
                                <LinkIcon size={10} className="mr-1" /> {getChainName(booking.chainId)}
                              </p>
                            )}
                            {booking.txHash && (
                              <a
                                href={`https://arbiscan.io/tx/${booking.txHash}`}
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
                          <span className="text-[#2c331f] font-black text-xs flex items-center">
                            <CheckCircle size={12} className="mr-1" /> Paid
                          </span>
                        ) : (
                          <span className="text-[#2c331f]/50 text-sm font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}