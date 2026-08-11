"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Users, 
  UserCheck, 
  DollarSign, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Search, 
  TrendingUp, 
  Edit, 
  Award,
  Clock
} from "lucide-react";

interface MetricsData {
  stay: {
    id: string;
    stayId: string;
    title: string;
    location: string;
    venue?: string;
    startDate: string;
    endDate: string;
    status: string;
    isPublished: boolean;
    slotsTotal: number;
    slotsAvailable: number;
    priceUSDC: number;
    heroImage?: string;
  };
  metrics: {
    totalBookings: number;
    activeBookingsCount: number;
    cancelledBookingsCount: number;
    pendingBookingsCount: number;
    totalRevenueUSDC: number;
    totalGuestsRegistered: number;
    totalTicketsIssued: number;
    totalCheckedIn: number;
    attendanceRate: number;
    occupancyRate: number;
  };
  attendeesRoster: Array<{
    ticketId: string;
    ticketCode: string;
    guestName: string;
    guestEmail: string;
    bookingId: string;
    roomName: string;
    bookingStatus: string;
    checkedIn: boolean;
    checkedInAt: string | null;
    checkedInBy: string | null;
  }>;
}

export default function EventMetricsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const stayId = resolvedParams.id;

  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "CHECKED_IN" | "NOT_CHECKED_IN">("ALL");

  useEffect(() => {
    fetchMetrics();
  }, [stayId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/stays/${stayId}/metrics`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to fetch metrics");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10 flex items-center justify-center">
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-5"></div>
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading event metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/admin/past-events" 
            className="inline-flex items-center gap-2 text-[#5a6b3a] font-bold uppercase tracking-widest text-xs mb-6 hover:text-[#2c331f]"
          >
            <ArrowLeft size={16} /> Back to Past Events
          </Link>
          <div className="p-6 bg-red-100 rounded-2xl border-2 border-red-500 shadow-[4px_4px_0px_0px_#ef4444] text-red-700 font-bold">
            Error loading metrics: {error || "Data unavailable"}
          </div>
        </div>
      </div>
    );
  }

  const { stay, metrics, attendeesRoster } = data;

  const filteredAttendees = attendeesRoster.filter((attendee) => {
    const matchesSearch = 
      attendee.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendee.guestEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attendee.ticketCode.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === "CHECKED_IN") return matchesSearch && attendee.checkedIn;
    if (filterStatus === "NOT_CHECKED_IN") return matchesSearch && !attendee.checkedIn;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10 font-inter text-[#2c331f]">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <Link 
              href="/admin/past-events" 
              className="inline-flex items-center gap-2 text-[#5a6b3a] font-bold uppercase tracking-widest text-xs mb-3 hover:text-[#2c331f] transition-colors"
            >
              <ArrowLeft size={16} /> Back to Past Events
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight text-[#2c331f]">
                {stay.title}
              </h1>
              <span className="bg-[#2c331f] text-[#f7eedb] px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest">
                {stay.stayId}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs font-bold text-[#5a6b3a] uppercase tracking-widest flex-wrap">
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#2c331f]" /> {stay.location}</span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-[#2c331f]" /> 
                {new Date(stay.startDate).toLocaleDateString()} – {new Date(stay.endDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/admin/past-events/${stay.id}`}
              className="flex items-center gap-2 py-3 px-5 bg-[#e8c37b] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-[2px] hover:translate-x-[2px] transition-all font-bold uppercase tracking-widest text-xs"
            >
              <Edit size={16} /> Edit Public Details
            </Link>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          
          {/* Card 1: Registered Guests */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest">Registrations</span>
              <div className="w-10 h-10 rounded-xl bg-[#f7eedb] border-2 border-[#2c331f] flex items-center justify-center text-[#2c331f]">
                <Users size={20} />
              </div>
            </div>
            <p className="text-4xl font-black font-display text-[#2c331f] mb-1">
              {metrics.totalGuestsRegistered}
            </p>
            <p className="text-[11px] font-semibold text-gray-600">
              {metrics.activeBookingsCount} active bookings ({metrics.cancelledBookingsCount} cancelled)
            </p>
          </div>

          {/* Card 2: Showed Up (Checked-In) */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest">Showed Up</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border-2 border-emerald-600 flex items-center justify-center text-emerald-800">
                <UserCheck size={20} />
              </div>
            </div>
            <p className="text-4xl font-black font-display text-[#2c331f] mb-1">
              {metrics.totalCheckedIn} <span className="text-sm font-bold text-gray-500">/ {metrics.totalTicketsIssued || metrics.totalGuestsRegistered}</span>
            </p>
            <p className="text-[11px] font-semibold text-emerald-700">
              Scanned / Checked-in attendees
            </p>
          </div>

          {/* Card 3: Attendance Rate */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest">Turnout Rate</span>
              <div className="w-10 h-10 rounded-xl bg-blue-100 border-2 border-blue-600 flex items-center justify-center text-blue-800">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-4xl font-black font-display text-[#2c331f] mb-2">
              {metrics.attendanceRate}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 border border-[#2c331f] overflow-hidden">
              <div 
                className="bg-[#9db47d] h-2.5 rounded-full" 
                style={{ width: `${Math.min(100, metrics.attendanceRate)}%` }}
              ></div>
            </div>
          </div>

          {/* Card 4: Total Revenue */}
          <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest">Revenue Collected</span>
              <div className="w-10 h-10 rounded-xl bg-[#e8c37b] border-2 border-[#2c331f] flex items-center justify-center text-[#2c331f]">
                <DollarSign size={20} />
              </div>
            </div>
            <p className="text-4xl font-black font-display text-[#2c331f] mb-1">
              ${metrics.totalRevenueUSDC.toLocaleString()} <span className="text-xs font-bold text-gray-500">USDC</span>
            </p>
            <p className="text-[11px] font-semibold text-gray-600">
              Occupancy: {metrics.occupancyRate}% ({stay.slotsTotal - stay.slotsAvailable} / {stay.slotsTotal} bunks)
            </p>
          </div>

        </div>

        {/* Attendees List / Roster Section */}
        <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-6 lg:p-8">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black text-[#2c331f] font-display">
                Guest Attendance Roster
              </h2>
              <p className="text-xs font-bold text-[#5a6b3a] uppercase tracking-widest">
                Showing {filteredAttendees.length} of {attendeesRoster.length} guests
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search name, email, code..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-[#2c331f] placeholder:text-gray-500 focus:outline-none"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl px-4 py-2.5 text-xs font-bold text-[#2c331f] focus:outline-none"
              >
                <option value="ALL">All Guests</option>
                <option value="CHECKED_IN">Showed Up (Checked In)</option>
                <option value="NOT_CHECKED_IN">No Show (Not Checked In)</option>
              </select>
            </div>
          </div>

          {/* Roster Table */}
          {filteredAttendees.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Users size={36} className="mx-auto mb-3 text-gray-400" />
              <p className="font-bold text-sm text-gray-600">No guests match the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#2c331f] bg-[#f7eedb] text-[#2c331f] text-[11px] font-black uppercase tracking-widest">
                    <th className="py-3 px-4">Guest Name</th>
                    <th className="py-3 px-4">Ticket / Code</th>
                    <th className="py-3 px-4">Room Type</th>
                    <th className="py-3 px-4">Booking Status</th>
                    <th className="py-3 px-4">Attendance Status</th>
                    <th className="py-3 px-4">Checked-In Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b-2 border-[#2c331f]">
                  {filteredAttendees.map((att, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors text-xs font-medium">
                      <td className="py-4 px-4">
                        <div className="font-black text-[#2c331f] text-sm">{att.guestName}</div>
                        <div className="text-gray-500 text-[11px] font-semibold">{att.guestEmail}</div>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-xs text-[#2c331f]">
                        <span className="bg-[#f7eedb] px-2 py-1 rounded border border-[#2c331f]">
                          {att.ticketCode}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-700">
                        {att.roomName}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${
                          att.bookingStatus === 'CONFIRMED' || att.bookingStatus === 'RESERVED'
                            ? 'bg-green-100 border-green-600 text-green-800'
                            : att.bookingStatus === 'CANCELLED'
                            ? 'bg-red-100 border-red-500 text-red-700'
                            : 'bg-yellow-100 border-yellow-600 text-yellow-800'
                        }`}>
                          {att.bookingStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {att.checkedIn ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border-2 border-emerald-600 text-emerald-800 font-black text-[10px] uppercase tracking-widest">
                            <CheckCircle2 size={13} /> Showed Up
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-400 text-gray-600 font-bold text-[10px] uppercase tracking-widest">
                            <XCircle size={13} /> Not Checked In
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-600 font-semibold text-[11px]">
                        {att.checkedInAt ? (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" /> {att.checkedInAt}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
