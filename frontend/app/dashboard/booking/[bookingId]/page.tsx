"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
  Twitter,
  Eye,
  EyeOff,
  QrCode,
  ChevronDown,
  Ticket as TicketIcon,
} from "lucide-react";
import { getChainName, chainConfig } from "@/lib/config";
import { BookingNFTCard } from "@/components/BookingNFTCard";

type Guest = {
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

type BookingDetail = {
  bookingId: string;
  status: string;
  txHash: string | null;
  chainId: number | null;
  chain: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  blockNumber: number | null;

  paymentToken: string | null;
  paymentAmount: number | null;

  requiresReservation: boolean;
  reservationAmount: number | null;
  reservationPaid: boolean;
  remainingAmount: number | null;
  remainingPaid: boolean;
  numberOfNights: number | null;

  guestName: string | null;
  guestEmail: string | null;
  guestMobile: string | null;
  guestCount: number | null;
  guests: Guest[] | null;
  optInGuestList: boolean;

  checkInDate: string | null;
  checkOutDate: string | null;

  pricePerNightUSDC: number | null;
  pricePerNightUSDT: number | null;
  selectedRoomName: string | null;
  selectedRoomPriceUSDC: number | null;
  selectedRoomPriceUSDT: number | null;
  finalPrice: number | null;
  originalPrice: number | null;
  totalPaid: number | null;
  discountPercent: number | null;
  referralCodeUsed: string | null;

  nftMinted: boolean;
  nftTokenId: string | null;
  nftContractAddress: string | null;

  stay: {
    stayId: string;
    title: string;
    location: string;
    venue: string | null;
    description: string;
    shortDescription: string | null;
    startDate: string;
    endDate: string;
    images: string[];
    heroImage: string | null;
    amenities: string[];
    highlights: string[];
    rules: string[];
    checkInTime: string | null;
    checkOutTime: string | null;
    guestListEnabled: boolean;
    priceUSDC: number;
    priceUSDT: number;
  };
};

type GuestListEntry = {
  name: string;
  role: string | null;
  xHandle: string | null;
  isPrimary: boolean;
};

type TicketSummary = {
  ticketCode: string;
  status: string;
  guestName: string | null;
  guestIndex: number;
  checkedInAt: string | null;
  nftMinted: boolean;
};

const STATUS_STYLES: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
  WAITLISTED: { label: "Under Review", classes: "bg-[#f7eedb] text-[#2c331f]", icon: <Clock size={14} /> },
  PENDING: { label: "Payment Required", classes: "bg-[#9db47d] text-[#2c331f]", icon: <Clock size={14} /> },
  RESERVED: { label: "Spot Reserved", classes: "bg-[#e8c37b] text-[#2c331f]", icon: <Clock size={14} /> },
  CONFIRMED: { label: "Confirmed", classes: "bg-[#2c331f] text-[#f7eedb]", icon: <CheckCircle2 size={14} /> },
  EXPIRED: { label: "Expired", classes: "bg-[#f7eedb] text-[#2c331f]", icon: <AlertCircle size={14} /> },
  CANCELLED: { label: "Cancelled", classes: "bg-[#f7eedb] text-[#2c331f]", icon: <AlertCircle size={14} /> },
  REFUNDED: { label: "Refunded", classes: "bg-[#f7eedb] text-[#2c331f]", icon: <AlertCircle size={14} /> },
  FAILED: { label: "Payment Failed", classes: "bg-[#f7eedb] text-[#2c331f]", icon: <AlertCircle size={14} /> },
};

const ACCEPTED_STATUSES = ["CONFIRMED", "RESERVED"];

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guestList, setGuestList] = useState<GuestListEntry[] | null>(null);
  const [guestListError, setGuestListError] = useState<string | null>(null);
  const [guestListLoading, setGuestListLoading] = useState(false);
  const [optInSaving, setOptInSaving] = useState(false);

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [ticketQr, setTicketQr] = useState<Record<string, string>>({});
  const [loadingQr, setLoadingQr] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/bookings/${bookingId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load booking");
        setBooking(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  // "Who's coming" only applies once the guest is actually accepted, and
  // only if the stay's organiser turned it on.
  useEffect(() => {
    if (!booking) return;
    if (!booking.stay.guestListEnabled) return;
    if (!ACCEPTED_STATUSES.includes(booking.status)) return;

    (async () => {
      try {
        setGuestListLoading(true);
        setGuestListError(null);
        const res = await fetch(`/api/stays/${booking.stay.stayId}/guest-list`);
        const data = await res.json();
        if (!res.ok) {
          setGuestListError(data.error || "Could not load guest list");
          return;
        }
        setGuestList(data.guests);
      } catch (err: any) {
        setGuestListError(err.message);
      } finally {
        setGuestListLoading(false);
      }
    })();
  }, [booking]);

  // Tickets exist per-guest once payment is confirmed. GET /api/tickets
  // returns the user's full list across every booking, so filter down to
  // this one.
  useEffect(() => {
    if (!booking) return;
    if (!ACCEPTED_STATUSES.includes(booking.status)) return;

    (async () => {
      try {
        const res = await fetch("/api/tickets");
        const data = await res.json();
        if (!res.ok) return;
        setTickets(
          (data as any[])
            .filter((t) => t.booking?.bookingId === bookingId)
            .sort((a, b) => a.guestIndex - b.guestIndex)
        );
      } catch {
        // Non-critical — tickets section just stays empty.
      }
    })();
  }, [booking, bookingId]);

  const toggleTicket = async (ticketCode: string) => {
    if (expandedTicket === ticketCode) {
      setExpandedTicket(null);
      return;
    }
    setExpandedTicket(ticketCode);
    if (ticketQr[ticketCode]) return;
    setLoadingQr(ticketCode);
    try {
      const res = await fetch(`/api/tickets/${ticketCode}`);
      const data = await res.json();
      if (res.ok && data.qrDataUrl) {
        setTicketQr((prev) => ({ ...prev, [ticketCode]: data.qrDataUrl }));
      }
    } catch {
      // Leave unset — card will just show a spinner-then-nothing rather than crash.
    } finally {
      setLoadingQr(null);
    }
  };

  const toggleOptIn = async () => {
    if (!booking) return;
    const next = !booking.optInGuestList;
    setOptInSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/guest-list-optin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setBooking((prev) => (prev ? { ...prev, optInGuestList: data.optInGuestList } : prev));
      // Re-fetch so the requester's own name appears/disappears immediately.
      if (booking.stay.guestListEnabled) {
        const listRes = await fetch(`/api/stays/${booking.stay.stayId}/guest-list`);
        const listData = await listRes.json();
        if (listRes.ok) setGuestList(listData.guests);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOptInSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7eedb] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#2c331f] animate-spin" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#f7eedb] flex items-center justify-center p-6">
        <div className="text-center bg-white border-2 border-[#2c331f] rounded-2xl shadow-[4px_4px_0px_0px_#2c331f] p-10 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="font-bold text-[#2c331f] mb-6">{error || "Booking not found"}</p>
          <Link
            href="/dashboard"
            className="inline-block py-3 px-6 bg-[#2c331f] text-[#f7eedb] rounded-xl font-bold uppercase tracking-widest text-xs"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_STYLES[booking.status] || {
    label: booking.status,
    classes: "bg-[#f7eedb] text-[#2c331f]",
    icon: <Clock size={14} />,
  };

  const partySize = booking.guestCount ?? booking.guests?.length ?? 1;
  const additionalGuests = (booking.guests || []).slice(1);
  const nights = booking.numberOfNights || 0;
  const bookingTotal = booking.finalPrice ?? booking.selectedRoomPriceUSDC ?? booking.paymentAmount;

  const amountDue =
    booking.status === "RESERVED"
      ? booking.remainingAmount
      : booking.status === "PENDING"
        ? booking.requiresReservation && !booking.reservationPaid
          ? booking.reservationAmount
          : bookingTotal
        : null;

  const explorerUrl =
    booking.txHash && booking.chainId
      ? `${chainConfig[booking.chainId]?.blockExplorer || "https://etherscan.io"}/tx/${booking.txHash}`
      : null;

  return (
    <div className="min-h-screen bg-[#f7eedb] text-[#2c331f]">
      <div className="max-w-[900px] mx-auto p-5 md:p-8">
        {/* Back */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#5a6b3a] hover:text-[#2c331f] transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* Hero */}
        {(booking.stay.heroImage || booking.stay.images?.[0]) && (
          <div
            className="w-full h-48 md:h-64 rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] mb-6 bg-cover bg-center"
            style={{ backgroundImage: `url(${booking.stay.heroImage || booking.stay.images[0]})` }}
          />
        )}

        {/* Title + status */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-3 ${statusInfo.classes}`}
            >
              {statusInfo.icon} {statusInfo.label}
            </span>
            <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight leading-tight">
              {booking.stay.title}
            </h1>
            <p className="text-sm font-bold text-[#5a6b3a] uppercase tracking-widest mt-1 flex items-center gap-1.5">
              <MapPin size={14} /> {booking.stay.venue ? `${booking.stay.venue}, ` : ""}
              {booking.stay.location}
            </p>
          </div>

          {bookingTotal !== null && (
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">
                {booking.status === "CONFIRMED" ? "Total Paid" : "Booking Total"}
              </div>
              <div className="text-2xl font-black font-display">
                ${booking.status === "CONFIRMED" ? (booking.totalPaid ?? bookingTotal) : bookingTotal}
              </div>
            </div>
          )}
        </div>

        {/* Amount due banner */}
        {amountDue !== null && amountDue !== undefined && amountDue > 0 && (
          <div className="mt-4 p-4 bg-[#e8c37b] border-2 border-[#2c331f] rounded-2xl flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest">
              {booking.status === "RESERVED" ? "Remaining balance" : "Payment required"}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-black">${amountDue} {booking.paymentToken || "USDC"}</span>
              <Link
                href={`/booking/${booking.bookingId}`}
                className="py-2 px-5 bg-[#2c331f] text-[#f7eedb] rounded-xl font-bold uppercase tracking-widest text-[10px] hover:opacity-90 transition-opacity"
              >
                Pay Now
              </Link>
            </div>
          </div>
        )}

        {/* Stay description */}
        {(booking.stay.shortDescription || booking.stay.description) && (
          <p className="mt-6 text-sm font-medium text-[#2c331f]/80 leading-relaxed">
            {booking.stay.shortDescription || booking.stay.description}
          </p>
        )}

        {/* Stay period */}
        {booking.checkInDate && booking.checkOutDate && (
          <div className="mt-6 bg-white border-2 border-[#2c331f] rounded-2xl p-5 flex items-center justify-between shadow-[3px_3px_0px_0px_#2c331f]">
            <div>
              <div className="text-[10px] font-bold text-[#2c331f]/50 uppercase tracking-widest mb-1">Check-in</div>
              <div className="font-black text-sm">
                {new Date(booking.checkInDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              {booking.stay.checkInTime && (
                <div className="text-[10px] font-bold text-[#5a6b3a] mt-0.5">from {booking.stay.checkInTime}</div>
              )}
            </div>
            <div className="font-bold text-[#5a6b3a] text-xs px-3 py-1.5 border-2 border-[#2c331f] rounded-full bg-[#f7eedb] shrink-0">
              {nights} night{nights !== 1 ? "s" : ""}
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-[#2c331f]/50 uppercase tracking-widest mb-1">Check-out</div>
              <div className="font-black text-sm">
                {new Date(booking.checkOutDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              {booking.stay.checkOutTime && (
                <div className="text-[10px] font-bold text-[#5a6b3a] mt-0.5">by {booking.stay.checkOutTime}</div>
              )}
            </div>
          </div>
        )}

        {/* Your Tickets — one per guest, expands to the check-in QR */}
        {tickets.length > 0 && (
          <div className="mt-6 bg-white border-2 border-[#2c331f] rounded-2xl p-5 shadow-[3px_3px_0px_0px_#2c331f]">
            <h2 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <TicketIcon size={16} /> Your Tickets
            </h2>
            <div className="space-y-2">
              {tickets.map((t) => {
                const isOpen = expandedTicket === t.ticketCode;
                return (
                  <div
                    key={t.ticketCode}
                    className="border border-[#2c331f]/15 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => toggleTicket(t.ticketCode)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#f7eedb] hover:bg-[#ede3c9] transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <QrCode size={14} className="text-[#5a6b3a] shrink-0" />
                        <span className="text-xs font-black truncate">
                          {t.guestName || `Guest ${t.guestIndex + 1}`}
                        </span>
                        {t.status === "CHECKED_IN" && (
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-[#9db47d] text-[#2c331f] px-2 py-0.5 rounded-full shrink-0">
                            Checked In
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-[#5a6b3a] shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="p-5 flex flex-col items-center gap-2 border-t border-[#2c331f]/10">
                        {loadingQr === t.ticketCode ? (
                          <Loader2 className="w-8 h-8 text-[#2c331f]/40 animate-spin my-6" />
                        ) : ticketQr[t.ticketCode] ? (
                          <>
                            <img
                              src={ticketQr[t.ticketCode]}
                              alt={`QR code for ${t.guestName || "guest"}`}
                              className="w-48 h-48 rounded-lg border-2 border-[#2c331f]"
                            />
                            <code className="text-[10px] font-bold text-[#5a6b3a] tracking-widest">
                              {t.ticketCode}
                            </code>
                          </>
                        ) : (
                          <p className="text-xs font-medium text-[#5a6b3a] my-6">
                            Couldn't load this QR — try again.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Two-column: application details / who's coming */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Application details */}
          <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-5 shadow-[3px_3px_0px_0px_#2c331f]">
            <h2 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles size={16} /> Application Details
            </h2>

            <div className="space-y-2.5 text-xs">
              <Row label="Booking ID" value={<code className="bg-[#f7eedb] px-2 py-0.5 rounded border border-[#2c331f] text-[10px] font-bold">{booking.bookingId}</code>} />
              <Row label="Applied on" value={new Date(booking.createdAt).toLocaleDateString()} />
              {booking.selectedRoomName && <Row label="Room" value={booking.selectedRoomName} />}
              <Row label="Party size" value={`${partySize} guest${partySize !== 1 ? "s" : ""}`} />
              {booking.pricePerNightUSDC && (
                <Row label="Rate" value={`$${booking.pricePerNightUSDC}/night`} />
              )}
              {(booking.discountPercent ?? 0) > 0 && (
                <Row label="Discount" value={`${booking.discountPercent}%${booking.referralCodeUsed ? ` (${booking.referralCodeUsed})` : ""}`} />
              )}
              {booking.requiresReservation && (
                <>
                  <Row label="Reservation" value={`$${booking.reservationAmount} ${booking.reservationPaid ? "· Paid" : "· Pending"}`} />
                  <Row label="Remaining" value={`$${booking.remainingAmount} ${booking.remainingPaid ? "· Paid" : "· Pending"}`} />
                </>
              )}
              {booking.txHash && explorerUrl && (
                <Row
                  label={booking.chainId ? getChainName(booking.chainId) : "Transaction"}
                  value={
                    <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#2c331f] hover:text-[#5a6b3a] underline underline-offset-2 font-bold">
                      {booking.txHash.slice(0, 8)}...{booking.txHash.slice(-6)} <ExternalLink size={10} />
                    </a>
                  }
                />
              )}
            </div>

            {additionalGuests.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#2c331f]/10">
                <div className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest mb-2">
                  Your Guests
                </div>
                <div className="space-y-1.5">
                  {additionalGuests.map((g, i) => (
                    <div key={i} className="text-xs font-bold flex items-center gap-2">
                      <Users size={12} className="text-[#5a6b3a] shrink-0" />
                      {g.fullName || `Guest ${i + 2}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {booking.nftMinted && (
              <div className="mt-4 pt-4 border-t border-[#2c331f]/10">
                <BookingNFTCard
                  booking={{
                    bookingId: booking.bookingId,
                    nftMinted: booking.nftMinted,
                    nftTokenId: booking.nftTokenId || undefined,
                    nftContractAddress: booking.nftContractAddress || undefined,
                    chainId: booking.chainId || undefined,
                    stayTitle: booking.stay.title,
                  }}
                />
              </div>
            )}
          </div>

          {/* Who's coming */}
          <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-5 shadow-[3px_3px_0px_0px_#2c331f]">
            <h2 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={16} /> Who's Coming
            </h2>

            {!booking.stay.guestListEnabled ? (
              <p className="text-xs font-medium text-[#5a6b3a]">
                The organiser hasn't turned on the guest list for this stay yet.
              </p>
            ) : !ACCEPTED_STATUSES.includes(booking.status) ? (
              <p className="text-xs font-medium text-[#5a6b3a]">
                Available once your spot is confirmed or reserved.
              </p>
            ) : (
              <>
                {/* Opt-in control */}
                <button
                  onClick={toggleOptIn}
                  disabled={optInSaving}
                  className={`w-full mb-4 py-2.5 px-4 rounded-xl border-2 border-[#2c331f] font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                    booking.optInGuestList ? "bg-[#9db47d] text-[#2c331f]" : "bg-[#f7eedb] text-[#2c331f] hover:bg-[#ede3c9]"
                  }`}
                >
                  {optInSaving ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : booking.optInGuestList ? (
                    <Eye size={13} />
                  ) : (
                    <EyeOff size={13} />
                  )}
                  {booking.optInGuestList ? "You're visible to other guests" : "Show me in the guest list"}
                </button>

                {guestListLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 text-[#2c331f]/40 animate-spin" />
                  </div>
                ) : guestListError ? (
                  <p className="text-xs font-medium text-[#5a6b3a]">{guestListError}</p>
                ) : !guestList || guestList.length === 0 ? (
                  <p className="text-xs font-medium text-[#5a6b3a]">
                    No one has opted in to be shown yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {guestList.map((g, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 bg-[#f7eedb] rounded-xl px-3 py-2.5 border border-[#2c331f]/10">
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">{g.name}</div>
                          {g.role && <div className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest">{g.role}</div>}
                        </div>
                        {g.xHandle && (
                          <a
                            href={`https://x.com/${g.xHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-[#2c331f]/70 hover:text-[#2c331f] shrink-0"
                          >
                            <Twitter size={12} /> @{g.xHandle}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Amenities / highlights / rules */}
        {(booking.stay.amenities?.length > 0 || booking.stay.highlights?.length > 0) && (
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {booking.stay.amenities?.length > 0 && (
              <InfoList title="Amenities" items={booking.stay.amenities} />
            )}
            {booking.stay.highlights?.length > 0 && (
              <InfoList title="Highlights" items={booking.stay.highlights} />
            )}
          </div>
        )}

        {booking.stay.rules?.length > 0 && (
          <div className="mt-6">
            <InfoList title="House Rules" items={booking.stay.rules} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold text-[#5a6b3a] uppercase tracking-widest shrink-0">{label}</span>
      <span className="font-bold text-right">{value}</span>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white border-2 border-[#2c331f] rounded-2xl p-5 shadow-[3px_3px_0px_0px_#2c331f]">
      <h3 className="text-sm font-black uppercase tracking-widest mb-3">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs font-medium text-[#2c331f]/80 flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9db47d] mt-1.5 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
