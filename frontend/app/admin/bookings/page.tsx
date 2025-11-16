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
  X
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

type TabType = "WAITLISTED" | "PENDING" | "CONFIRMED" | "ALL";

// Helper function - defined before component to avoid hoisting issues
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
  const [showFilters, setShowFilters] = useState(false);

  // Fetch bookings - ALWAYS fetch ALL bookings for correct stats
  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Always fetch ALL bookings (no status filter)
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
  }, []); // Only fetch once on mount

  const handleApproved = () => {
    fetchBookings(); // Refresh all bookings
  };

  // Get unique stays for filter
  const uniqueStays = Array.from(
    new Set(bookings.map(b => b.stay.stayId))
  ).map(stayId => {
    const booking = bookings.find(b => b.stay.stayId === stayId);
    return {
      id: stayId,
      title: booking?.stay.title || stayId
    };
  });

  // Filter bookings by tab, search, and stay
  const filteredBookings = bookings.filter(booking => {
    // Filter by active tab
    const matchesTab = 
      activeTab === "ALL" || 
      booking.status === activeTab;
    
    // Filter by search term
    const matchesSearch = 
      booking.guestName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.guestEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.user.walletAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by selected stay
    const matchesStay = selectedStay === "ALL" || booking.stay.stayId === selectedStay;
    
    return matchesTab && matchesSearch && matchesStay;
  });

  // Calculate statistics
  const stats = {
    waitlisted: bookings.filter(b => b.status === 'WAITLISTED').length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    total: bookings.length,
  };

  // Calculate revenue analytics
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      WAITLISTED: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Waitlisted' },
      PENDING: { bg: 'bg-blue-100', text: 'text-blue-800', label: '💳 Pending Payment' },
      CONFIRMED: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Confirmed' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', label: '❌ Cancelled' },
      EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-800', label: '⌛ Expired' },
      FAILED: { bg: 'bg-pink-100', text: 'text-pink-800', label: '⚠️ Failed' },
    };

    const style = styles[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    
    return (
      <span className={`${style.bg} ${style.text} px-3 py-1 rounded-full text-xs font-semibold`}>
        {style.label}
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Booking Management
          </h1>
          <p className="text-gray-600">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="text-yellow-600" size={24} />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {stats.waitlisted}
              </span>
            </div>
            <p className="text-sm text-gray-600">Pending Approval</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-blue-600" size={24} />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {stats.pending}
              </span>
            </div>
            <p className="text-sm text-gray-600">Awaiting Payment</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {stats.confirmed}
              </span>
            </div>
            <p className="text-sm text-gray-600">Confirmed</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="text-purple-600" size={24} />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {stats.total}
              </span>
            </div>
            <p className="text-sm text-gray-600">Total Bookings</p>
          </div>
        </div>

        {/* Revenue Analytics */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Revenue Analytics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Total USDC Received</p>
              <p className="text-3xl font-bold text-green-600">
                ${analytics.totalUSDC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Total USDT Received</p>
              <p className="text-3xl font-bold text-purple-600">
                ${analytics.totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">By Chain</h3>
            {Object.entries(analytics.byChain).map(([chain, amounts]) => (
              <div key={chain} className="bg-gray-50 rounded-lg p-4">
                <p className="font-semibold text-gray-900 mb-2">{chain}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">USDC</p>
                    <p className="text-lg font-bold text-green-600">
                      ${amounts.USDC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">USDT</p>
                    <p className="text-lg font-bold text-purple-600">
                      ${amounts.USDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by name, email, booking ID, or wallet..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Stay Filter */}
            <div className="relative">
              <select
                value={selectedStay}
                onChange={(e) => setSelectedStay(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="ALL">All Events</option>
                {uniqueStays.map(stay => (
                  <option key={stay.id} value={stay.id}>
                    {stay.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>

            {/* Export Button */}
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Download size={20} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {(['WAITLISTED', 'PENDING', 'CONFIRMED', 'ALL'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab === 'ALL' ? stats.total : stats[tab.toLowerCase() as keyof typeof stats]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Info */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredBookings.length} of {bookings.length} bookings
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Booking Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Guest Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Room & Pricing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Payment Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No bookings found
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => (
                    <tr key={booking.bookingId} className="hover:bg-gray-50 transition-colors">
                      {/* Booking Details */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-gray-600">
                            {booking.bookingId}
                          </p>
                          <p className="font-semibold text-gray-900">
                            {booking.stay.title}
                          </p>
                          <p className="text-sm text-gray-600">
                            📍 {booking.stay.location}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(booking.createdAt).toLocaleDateString()} at{' '}
                            {new Date(booking.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>

                      {/* Guest Info */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900">
                            {booking.user.displayName}
                          </p>
                          <p className="text-sm text-gray-600">
                            ✉️ {booking.user.email}
                          </p>
                          {(booking.user.mobileNumber || booking.guestMobile) && (
                            <p className="text-sm text-gray-600">
                              📱 {booking.user.mobileNumber || booking.guestMobile}
                            </p>
                          )}
                          {(booking.user.age || booking.guestAge) && (
                            <p className="text-xs text-gray-500">
                              Age: {booking.user.age || booking.guestAge}
                            </p>
                          )}
                          {(booking.user.gender || booking.guestGender) && (
                            <p className="text-xs text-gray-500">
                              Gender: {booking.user.gender || booking.guestGender}
                            </p>
                          )}
                          {booking.user.walletAddress && (
                            <p className="text-xs text-gray-500 font-mono">
                              🔐 {booking.user.walletAddress.slice(0, 6)}...{booking.user.walletAddress.slice(-4)}
                            </p>
                          )}
                          {booking.user.socialTwitter && (
                            <p className="text-xs text-blue-600">
                              🐦 {booking.user.socialTwitter}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Room & Pricing */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {booking.selectedRoomName ? (
                            <>
                              <p className="font-semibold text-gray-900">
                                🛏️ {booking.selectedRoomName}
                              </p>
                              {booking.numberOfNights && (
                                <p className="text-sm text-gray-600">
                                  {booking.numberOfNights} night{booking.numberOfNights !== 1 ? 's' : ''}
                                </p>
                              )}
                              {booking.pricePerNightUSDC && (
                                <p className="text-sm text-green-600">
                                  ${booking.pricePerNightUSDC}/night USDC
                                </p>
                              )}
                              {booking.pricePerNightUSDT && (
                                <p className="text-sm text-purple-600">
                                  ${booking.pricePerNightUSDT}/night USDT
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">
                              No room preference
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Payment Details */}
                      <td className="px-6 py-4">
                        {booking.status === 'CONFIRMED' && booking.paymentAmount ? (
                          <div className="space-y-1">
                            <p className="font-bold text-lg text-green-600">
                              ${booking.paymentAmount} {booking.paymentToken}
                            </p>
                            {booking.chainId && (
                              <p className="text-xs text-gray-600">
                                ⛓️ {getChainName(booking.chainId)}
                              </p>
                            )}
                            {booking.txHash && (
                              <a
                                href={`https://arbiscan.io/tx/${booking.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline font-mono block truncate max-w-[150px]"
                                title={booking.txHash}
                              >
                                {booking.txHash.slice(0, 8)}...{booking.txHash.slice(-6)}
                              </a>
                            )}
                            {booking.blockNumber && (
                              <p className="text-xs text-gray-500">
                                Block: {booking.blockNumber}
                              </p>
                            )}
                          </div>
                        ) : booking.selectedRoomPriceUSDC || booking.selectedRoomPriceUSDT ? (
                          <div className="space-y-1">
                            {booking.selectedRoomPriceUSDC && (
                              <p className="text-sm text-green-600">
                                ${booking.selectedRoomPriceUSDC} USDC
                              </p>
                            )}
                            {booking.selectedRoomPriceUSDT && (
                              <p className="text-sm text-purple-600">
                                ${booking.selectedRoomPriceUSDT} USDT
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            Not yet determined
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {getStatusBadge(booking.status)}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4">
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
                              className="text-sm text-blue-600 hover:underline block"
                            >
                              View Payment →
                            </a>
                            {booking.expiresAt && new Date(booking.expiresAt) > new Date() && (
                              <p className="text-xs text-amber-600">
                                Expires: {new Date(booking.expiresAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ) : booking.status === 'CONFIRMED' ? (
                          <span className="text-green-600 font-semibold text-sm">
                            ✓ Paid
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
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