"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Minus, Plus, Calendar, Check, AlertCircle, Loader2, Tag, Sparkles, Info } from "lucide-react";

const ACTIVE_NON_TERMINAL_STATUSES = ["WAITLISTED", "PENDING", "RESERVED", "CONFIRMED"];

type StayData = {
  id: string;
  stayId: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  duration: number;
  priceUSDC: number;
  priceUSDT: number;
  rooms: any[];
  requiresReservation?: boolean;
  reservationAmount?: number;
  minNightsForReservation?: number;
  loyaltyDiscountEnabled?: boolean;
  allowFlexibleDates?: boolean;
  coreStartDate?: string | null;
  coreEndDate?: string | null;
};

/** ISO timestamp -> the yyyy-MM-dd that <input type="date"> requires. */
function toDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

type GuestData = {
  fullName: string;
  email: string;
  phone: string;
  age: string;
  gender: string;
  country: string;
  profession: string;
  xHandle: string;
  telegram: string;
};

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stayId = params.stayId as string;

  const { data: session, status: sessionStatus } = useSession();

  const [stayData, setStayData] = useState<StayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // States
  const urlGuests = parseInt(searchParams.get("guests") || "1");
  const [occupancy, setOccupancy] = useState<number>(urlGuests > 0 ? urlGuests : 1);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [guests, setGuests] = useState<GuestData[]>([]);

  // Guest-chosen dates, only used when the stay allows flexible dates.
  // Defaults to the full stay window once the stay loads.
  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");
  const [dateError, setDateError] = useState<string | null>(null);

  // Loyalty (silent, based on the signed-in user's booking history)
  const [loyaltyInfo, setLoyaltyInfo] = useState<{ isEligible: boolean; discountPercent: number; previousBookingsCount: number } | null>(null);

  // If the user already has an active (non-terminal) booking for this exact
  // stay, submitting here extends it (adds guests, delta pricing) rather
  // than creating a duplicate — apply/route.ts already handles that merge,
  // but nothing told the user that's what's about to happen.
  const [existingBooking, setExistingBooking] = useState<{ bookingId: string; status: string; guestCount: number } | null>(null);

  // Referral code (live-validated against this stay before it's ever sent
  // with the application — an unvalidated/invalid code would otherwise make
  // the whole apply request fail server-side)
  const [referralInput, setReferralInput] = useState("");
  const [referralStatus, setReferralStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [referralInfo, setReferralInfo] = useState<{ discountPercent: number; communityName: string } | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStayData = async () => {
      try {
        const res = await fetch(`/api/stays/${stayId}`);
        if (!res.ok) throw new Error("Failed to fetch stay");
        const data = await res.json();
        setStayData(data);

        // Default to the required nights when the organiser set them (the
        // cheapest valid booking), otherwise the full window.
        const core = data.allowFlexibleDates && data.coreStartDate && data.coreEndDate;
        setCheckIn(toDateInput(core ? data.coreStartDate : data.startDate));
        setCheckOut(toDateInput(core ? data.coreEndDate : data.endDate));

        // Auto-select first room
        if (data.rooms && data.rooms.length > 0) {
          setSelectedRoomId(data.rooms[0].id);
        }
      } catch (err) {
        console.error("Error fetching stay data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (stayId) fetchStayData();
  }, [stayId]);

  useEffect(() => {
    if (!session || !stayId) return;
    fetch("/api/user/bookings")
      .then((res) => res.json())
      .then((bookings) => {
        if (!Array.isArray(bookings)) return;
        const match = bookings.find(
          (b: any) => b.stay?.stayId === stayId && ACTIVE_NON_TERMINAL_STATUSES.includes(b.status)
        );
        if (match) {
          setExistingBooking({ bookingId: match.bookingId, status: match.status, guestCount: match.guestCount || 1 });
        }
      })
      .catch(() => {});
  }, [session, stayId]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/user/check-loyalty")
      .then((res) => res.json())
      .then((data) => {
        if (data.isEligible) {
          setLoyaltyInfo({
            isEligible: true,
            discountPercent: data.discountPercent,
            previousBookingsCount: data.previousBookingsCount,
          });
        }
      })
      .catch(() => {});
  }, [session]);

  // Debounced live validation — loyalty (if eligible) beats referral, so a
  // code is pointless to check while it's already applied, but we still
  // validate it in case the user wants to compare or loyalty doesn't apply.
  useEffect(() => {
    const code = referralInput.trim();
    if (!code || !stayId) {
      setReferralStatus("idle");
      setReferralInfo(null);
      setReferralError(null);
      return;
    }
    setReferralStatus("checking");
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/referrals/validate?code=${encodeURIComponent(code)}&stayId=${stayId}`);
        const data = await res.json();
        if (data.valid) {
          setReferralStatus("valid");
          setReferralInfo({ discountPercent: data.discountPercent, communityName: data.communityName });
          setReferralError(null);
        } else {
          setReferralStatus("invalid");
          setReferralInfo(null);
          setReferralError(data.error || "Invalid code");
        }
      } catch {
        setReferralStatus("invalid");
        setReferralInfo(null);
        setReferralError("Could not validate code");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [referralInput, stayId]);

  // Sync guests array with occupancy count
  useEffect(() => {
    setGuests((prev) => {
      const newGuests = [...prev];
      if (newGuests.length < occupancy) {
        for (let i = newGuests.length; i < occupancy; i++) {
          newGuests.push({
            fullName: i === 0 && session?.user ? (session.user as any).name || "" : "",
            email: i === 0 && session?.user ? session.user.email || "" : "",
            phone: "",
            age: "",
            gender: "",
            country: "",
            profession: "",
            xHandle: "",
            telegram: "",
          });
        }
      } else if (newGuests.length > occupancy) {
        newGuests.splice(occupancy);
      }
      return newGuests;
    });
  }, [occupancy, session]);

  const updateGuest = (index: number, field: keyof GuestData, value: string) => {
    const newGuests = [...guests];
    newGuests[index] = { ...newGuests[index], [field]: value };
    setGuests(newGuests);
  };

  const getSelectedRoom = () => {
    if (!stayData || !stayData.rooms) return null;
    return stayData.rooms.find((r) => r.id === selectedRoomId);
  };

  const getPrice = () => {
    const room = getSelectedRoom();
    if (!room) return stayData?.priceUSDC || 0;
    return room.priceUSDC || stayData?.priceUSDC || 0;
  };

  const isFlexible = stayData?.allowFlexibleDates === true;

  // Mandatory core nights, if the organiser set them. Check-in can be no
  // later than the core start, and check-out no earlier than the core end,
  // so the picker itself makes an invalid range unreachable.
  const coreStart = isFlexible ? toDateInput(stayData?.coreStartDate) : "";
  const coreEnd = isFlexible ? toDateInput(stayData?.coreEndDate) : "";
  const hasCore = Boolean(coreStart && coreEnd);

  // Nights come from the guest's chosen range on flexible stays, otherwise
  // from the fixed event window. The server re-derives this the same way and
  // ignores whatever we send, so this is purely for live price preview.
  const getNights = () => {
    if (!stayData) return 0;
    const start = new Date(isFlexible && checkIn ? checkIn : stayData.startDate);
    const end = new Date(isFlexible && checkOut ? checkOut : stayData.endDate);
    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Number.isFinite(nights) && nights > 0 ? nights : 0;
  };

  const subtotal = getPrice() * getNights() * (guests.length || 1);

  // Loyalty beats referral when both apply — mirrors lib/pricing.ts, which
  // is the actual source of truth server-side; this is just a preview.
  // Gated by the stay's own loyaltyDiscountEnabled flag, same as pricing.ts.
  const loyaltyPercent = stayData?.loyaltyDiscountEnabled !== false ? loyaltyInfo?.discountPercent || 0 : 0;
  const referralPercent = referralStatus === "valid" ? referralInfo?.discountPercent || 0 : 0;
  const effectiveDiscountPercent = Math.max(loyaltyPercent, referralPercent);
  const isLoyaltyDiscount = effectiveDiscountPercent === loyaltyPercent && loyaltyPercent > 0;
  const discountAmount = (subtotal * effectiveDiscountPercent) / 100;
  const totalPayable = subtotal - discountAmount;

  const handleContinue = async () => {
    setApiError(null);
    if (!session) {
      setApiError("Please sign in to continue.");
      return;
    }
    
    // Validate guest 1
    if (!guests[0].fullName || !guests[0].email || !guests[0].phone) {
      setApiError("Guest 1 requires Full Name, Email, and Phone.");
      return;
    }

    if (isFlexible) {
      if (!checkIn || !checkOut) {
        setDateError("Please choose your check-in and check-out dates.");
        return;
      }
      if (checkOut <= checkIn) {
        setDateError("Check-out must be after check-in.");
        return;
      }
      if (hasCore && (checkIn > coreStart || checkOut < coreEnd)) {
        setDateError(
          `Your dates must cover the required nights (${new Date(coreStart).toLocaleDateString("en-US", { day: "2-digit", month: "short" })} – ${new Date(coreEnd).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}).`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        // No wallet is connected at application time anymore — wallet-connect
        // only happens at the payment step (components/PayWalletModal.tsx).
        walletAddress: "0x0000000000000000000000000000000000000000",
        email: guests[0].email,
        displayName: guests[0].fullName,
        firstName: guests[0].fullName.split(" ")[0],
        lastName: guests[0].fullName.split(" ").slice(1).join(" "),
        gender: guests[0].gender || "Other",
        age: parseInt(guests[0].age) || 25,
        mobileNumber: guests[0].phone,
        selectedRoomId,
        selectedCurrency: "USDC",
        // Sent for the record, but the server re-derives nights from the
        // dates (and ignores both entirely on fixed-date stays) — pricing is
        // never driven by what we send here.
        numberOfNights: getNights(),
        checkInDate: isFlexible && checkIn ? checkIn : stayData?.startDate,
        checkOutDate: isFlexible && checkOut ? checkOut : stayData?.endDate,
        guests: guests,
        ...(referralStatus === "valid" && referralInput.trim() ? { referralCode: referralInput.trim() } : {}),
      };

      const res = await fetch(`/api/stays/${stayId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to submit application");
      }

      router.push(`/booking/${result.booking.bookingId}`);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3EDE0] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#3D4331] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3EDE0] text-[#3D4331] font-sans selection:bg-[#3D4331] selection:text-[#F3EDE0]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
        
        {/* Header */}
        <div className="mb-10">
          <button onClick={() => router.back()} className="flex items-center gap-3 text-sm font-semibold tracking-widest uppercase hover:opacity-70 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center">
              <ArrowLeft size={16} />
            </div>
            Live Stays <span className="opacity-50">/ Book Your Stay</span>
          </button>
          <div className="mt-8">
            <h1 className="text-4xl md:text-5xl font-black mb-2 font-serif">Book Your Stay</h1>
            <p className="text-[#3D4331]/70 font-semibold tracking-wider uppercase text-sm">
              {stayData?.title} • {stayData?.location}
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="relative mb-16 max-w-4xl">
          <div className="absolute top-4 left-[15%] right-[15%] h-px bg-[#3D4331]/20 z-0" />
          <div className="flex justify-between">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center font-bold text-sm relative z-10">1</div>
              <span className="text-xs font-bold uppercase tracking-widest">Stay & Guests</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#F3EDE0] border border-[#3D4331]/20 text-[#3D4331]/40 flex items-center justify-center font-bold text-sm relative z-10">2</div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#3D4331]/40">Payment</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#F3EDE0] border border-[#3D4331]/20 text-[#3D4331]/40 flex items-center justify-center font-bold text-sm relative z-10">3</div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#3D4331]/40">Confirmation</span>
            </div>
          </div>
        </div>

        {existingBooking && (
          <div className="mb-10 max-w-4xl bg-[#EBE1D0] border border-[#3D4331]/20 rounded-2xl p-5 flex items-start gap-3">
            <Info size={18} className="text-[#8A9670] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">
                You already have a {existingBooking.status.toLowerCase()} booking for this stay ({existingBooking.guestCount} guest{existingBooking.guestCount !== 1 ? "s" : ""}).
              </p>
              <p className="text-sm opacity-70 mt-1">
                Submitting below will add the guests you enter here to that same booking, not create a new one — you'll only pay the difference.{" "}
                <Link href={`/dashboard/booking/${existingBooking.bookingId}`} className="underline font-semibold hover:opacity-80">
                  View existing booking
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 relative">
          
          {/* Left Column */}
          <div className="flex-1 space-y-12">
            
            {/* Duration of Stay */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-4">
                Duration of Stay
                <div className="h-px bg-[#3D4331]/20 flex-1" />
              </h2>
              <div className="bg-[#EBE1D0] rounded-[20px] p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-2xl font-black flex items-center gap-3">
                      <Calendar size={24} />
                      {getNights()} Nights • {getNights() + 1} Days
                    </div>
                    <p className="text-sm opacity-60 mt-1 font-medium">
                      {isFlexible
                        ? "Choose any dates inside the event window"
                        : "Fixed duration — set by the event organiser"}
                    </p>
                  </div>
                  <div className="bg-[#8A9670] text-[#F3EDE0] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {isFlexible ? "Flexible" : "Fixed"}
                  </div>
                </div>

                {isFlexible ? (
                  <>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">
                          Check-in
                        </label>
                        <input
                          type="date"
                          value={checkIn}
                          min={toDateInput(stayData?.startDate)}
                          max={hasCore ? coreStart : toDateInput(stayData?.endDate)}
                          onChange={(e) => {
                            const next = e.target.value;
                            setCheckIn(next);
                            setDateError(null);
                            // Keep the range coherent: push check-out out by a
                            // night if the new check-in would overtake it.
                            if (checkOut && next && next >= checkOut) {
                              const d = new Date(next);
                              d.setDate(d.getDate() + 1);
                              const bounded = toDateInput(stayData?.endDate);
                              const pushed = d.toISOString().slice(0, 10);
                              setCheckOut(bounded && pushed > bounded ? bounded : pushed);
                            }
                          }}
                          className="w-full bg-[#F3EDE0] border border-[#3D4331]/20 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-[#8A9670] transition-colors"
                        />
                      </div>

                      <ArrowLeft size={16} className="opacity-30 rotate-180 hidden sm:block mb-4" />

                      <div className="flex-1">
                        <label className="block text-[10px] uppercase tracking-widest font-bold opacity-50 mb-2">
                          Check-out
                        </label>
                        <input
                          type="date"
                          value={checkOut}
                          min={hasCore ? coreEnd : checkIn || toDateInput(stayData?.startDate)}
                          max={toDateInput(stayData?.endDate)}
                          onChange={(e) => {
                            setCheckOut(e.target.value);
                            setDateError(null);
                          }}
                          className="w-full bg-[#F3EDE0] border border-[#3D4331]/20 rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-[#8A9670] transition-colors"
                        />
                      </div>
                    </div>

                    {hasCore && (
                      <div className="mt-4 flex items-start gap-2 bg-[#F3EDE0] border border-[#8A9670]/40 rounded-xl px-4 py-3">
                        <Info size={15} className="text-[#8A9670] shrink-0 mt-0.5" />
                        <p className="text-xs font-medium">
                          <span className="font-bold">
                            {new Date(coreStart).toLocaleDateString("en-US", { day: "2-digit", month: "short" })} –{" "}
                            {new Date(coreEnd).toLocaleDateString("en-US", { day: "2-digit", month: "short" })} is required
                          </span>{" "}
                          for this stay. You can arrive earlier or leave later, but those nights are always included.
                        </p>
                      </div>
                    )}

                    <p className="text-xs opacity-60 mt-4 font-medium">
                      Available{" "}
                      {stayData?.startDate
                        ? new Date(stayData.startDate).toLocaleDateString("en-US", { day: "2-digit", month: "short" })
                        : ""}{" "}
                      –{" "}
                      {stayData?.endDate
                        ? new Date(stayData.endDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
                        : ""}
                      . You're charged per night for the dates you pick.
                    </p>

                    {dateError && (
                      <p className="mt-3 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                        {dateError}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-1">Check-in</p>
                      <p className="font-bold">{stayData?.startDate ? new Date(stayData.startDate).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Loading...'}</p>
                    </div>
                    <ArrowLeft size={16} className="opacity-30 rotate-180" />
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-1">Check-out</p>
                      <p className="font-bold">{stayData?.endDate ? new Date(stayData.endDate).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Loading...'}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Occupancy */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-4">
                Occupancy
                <div className="h-px bg-[#3D4331]/20 flex-1" />
              </h2>
              <div className="bg-[#EBE1D0] rounded-[20px] p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Adults</h3>
                    <p className="text-sm opacity-60">Age 15 and above</p>
                  </div>
                  <div className="flex items-center gap-4 bg-[#F3EDE0] rounded-full px-2 py-1">
                    <button 
                      onClick={() => setOccupancy(Math.max(1, occupancy - 1))}
                      className="w-8 h-8 rounded-full border border-[#3D4331]/20 flex items-center justify-center hover:bg-[#3D4331]/5 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-black w-4 text-center">{occupancy}</span>
                    <button 
                      onClick={() => setOccupancy(occupancy + 1)}
                      className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="h-px bg-[#3D4331]/10 w-full my-4" />
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="opacity-60">Total occupancy</span>
                  <span>{occupancy} Guests • 1 Room</span>
                </div>
              </div>
            </section>

            {/* Room Type */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-4">
                Room Type
                <div className="h-px bg-[#3D4331]/20 flex-1" />
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {stayData?.rooms?.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <div 
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`cursor-pointer rounded-[20px] p-6 transition-all duration-300 border-2 ${isSelected ? 'border-[#8A9670] bg-[#EBE1D0]/50' : 'border-transparent bg-[#EBE1D0] hover:bg-[#EBE1D0]/80'}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#8A9670]' : 'border-[#3D4331]/30'}`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#8A9670]" />}
                          </div>
                          <h3 className="font-bold text-lg">{room.name}</h3>
                        </div>
                        {isSelected && (
                          <div className="bg-[#8A9670] text-[#F3EDE0] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                            Selected
                          </div>
                        )}
                      </div>
                      <p className="text-sm opacity-80 mb-6 leading-relaxed h-10 line-clamp-2">{room.description}</p>
                      
                      <div className="flex gap-2 mb-6">
                        <span className="px-3 py-1 bg-[#3D4331]/10 rounded-full text-xs font-bold opacity-80">{room.capacity} Guests</span>
                        <span className="px-3 py-1 bg-[#3D4331]/10 rounded-full text-xs font-bold opacity-80">{room.beds}</span>
                      </div>

                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-black">${room.priceUSDC}</span>
                        <span className="text-xs font-bold opacity-50 mb-1">per night</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Guest Details */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-4">
                Guest Details
                <div className="h-px bg-[#3D4331]/20 flex-1" />
              </h2>
              
              <div className="space-y-6">
                {guests.map((guest, idx) => (
                  <div key={idx} className="bg-[#EBE1D0] rounded-[20px] p-6 md:p-8">
                    <div className="flex justify-between items-center mb-8 border-b border-[#3D4331]/10 pb-4">
                      <h3 className="font-black text-xl">Guest {idx + 1}</h3>
                      <p className="text-xs font-bold opacity-50 uppercase tracking-widest">
                        {idx === 0 ? "Primary contact • receives confirmation" : "Email & phone not required"}
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                      {/* Name */}
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Full Name {idx === 0 && "*"}</label>
                        <input 
                          type="text"
                          value={guest.fullName}
                          onChange={(e) => updateGuest(idx, 'fullName', e.target.value)}
                          className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                          placeholder="Jane Doe"
                        />
                      </div>

                      {/* Email (Guest 1 only) */}
                      {idx === 0 && (
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Email *</label>
                          <input 
                            type="email"
                            value={guest.email}
                            onChange={(e) => updateGuest(idx, 'email', e.target.value)}
                            className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                            placeholder="jane@example.com"
                          />
                        </div>
                      )}

                      {/* Phone */}
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Phone {idx === 0 && "*"}</label>
                        <input 
                          type="tel"
                          value={guest.phone}
                          onChange={(e) => updateGuest(idx, 'phone', e.target.value)}
                          className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                          placeholder="+1 234 567 890"
                        />
                      </div>

                      {/* Age & Gender */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Age</label>
                          <input 
                            type="number"
                            value={guest.age}
                            onChange={(e) => updateGuest(idx, 'age', e.target.value)}
                            className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                            placeholder="25"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Gender</label>
                          <select 
                            value={guest.gender}
                            onChange={(e) => updateGuest(idx, 'gender', e.target.value)}
                            className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg transition-colors cursor-pointer appearance-none"
                          >
                            <option value="">Select</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      {/* Country */}
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Country</label>
                        <input 
                          type="text"
                          value={guest.country}
                          onChange={(e) => updateGuest(idx, 'country', e.target.value)}
                          className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                          placeholder="e.g. India"
                        />
                      </div>

                      {/* Profession */}
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Profession - Optional</label>
                        <input 
                          type="text"
                          value={guest.profession}
                          onChange={(e) => updateGuest(idx, 'profession', e.target.value)}
                          className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                          placeholder="Product Designer"
                        />
                      </div>

                      {/* Socials */}
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">X - Optional</label>
                        <input 
                          type="text"
                          value={guest.xHandle}
                          onChange={(e) => updateGuest(idx, 'xHandle', e.target.value)}
                          className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                          placeholder="@username"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Telegram - Optional</label>
                        <input 
                          type="text"
                          value={guest.telegram}
                          onChange={(e) => updateGuest(idx, 'telegram', e.target.value)}
                          className="bg-transparent border-b border-[#3D4331]/20 pb-2 focus:outline-none focus:border-[#3D4331] font-bold text-lg placeholder-[#3D4331]/30 transition-colors"
                          placeholder="@username"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs opacity-60 mt-4 ml-2">Optional details help us pair roommates and share event updates — leave them blank if you prefer.</p>
            </section>
          </div>

          {/* Right Sidebar */}
          <div className="lg:w-[400px] flex-shrink-0">
            <div className="sticky top-8">
              <h2 className="text-2xl font-serif font-bold mb-4">Booking Summary</h2>
              <div className="bg-[#433B31] text-[#F3EDE0] rounded-[24px] p-8 shadow-2xl">
                <h3 className="text-2xl font-serif font-bold mb-1">{stayData?.title}</h3>
                <p className="text-xs opacity-70 font-semibold uppercase tracking-widest mb-8">{stayData?.location} • 1 Room</p>

                <div className="space-y-4 text-sm font-semibold mb-8 pb-8 border-b border-[#F3EDE0]/10">
                  <div className="flex justify-between">
                    <span className="opacity-70">Duration</span>
                    <span>{getNights() + 1} Days - {getNights()} Nights</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Check-in</span>
                    <span>{stayData?.startDate ? new Date(stayData.startDate).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Check-out</span>
                    <span>{stayData?.endDate ? new Date(stayData.endDate).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Occupancy</span>
                    <span>{occupancy} Guests</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Room type</span>
                    <span>{getSelectedRoom()?.name || "None"}</span>
                  </div>
                </div>

                <div className="space-y-4 text-sm font-semibold mb-6 pb-6 border-b border-[#F3EDE0]/10">
                  <div className="flex justify-between">
                    <span className="opacity-70">${getPrice()} x {getNights()} nights x {guests.length || 1} guest{(guests.length || 1) !== 1 ? "s" : ""}</span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                  {effectiveDiscountPercent > 0 && (
                    <div className="flex justify-between text-[#8A9670]">
                      <span className="flex items-center gap-1.5">
                        {isLoyaltyDiscount ? <Sparkles size={13} /> : <Tag size={13} />}
                        {isLoyaltyDiscount ? "Loyalty" : `Referral (${referralInfo?.communityName})`} discount ({effectiveDiscountPercent}%)
                      </span>
                      <span>-${discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Referral code */}
                <div className="mb-8">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2 block">Referral code — optional</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      placeholder="COMMUNITY10"
                      className="w-full bg-[#F3EDE0]/5 border border-[#F3EDE0]/20 rounded-xl px-4 py-3 pr-10 font-bold text-sm placeholder-[#F3EDE0]/30 focus:outline-none focus:border-[#8A9670] transition-colors uppercase"
                    />
                    {referralStatus === "checking" && (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin opacity-60" />
                    )}
                    {referralStatus === "valid" && (
                      <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9670]" />
                    )}
                  </div>
                  {referralStatus === "valid" && referralInfo && (
                    isLoyaltyDiscount ? (
                      <p className="text-[11px] text-[#F3EDE0]/60 mt-2">
                        Valid — {referralInfo.discountPercent}% off, but your loyalty discount is better and will be used instead.
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#8A9670] mt-2">
                        Applied — {referralInfo.communityName} · {referralInfo.discountPercent}% off
                      </p>
                    )
                  )}
                  {referralStatus === "invalid" && referralError && (
                    <p className="text-[11px] text-red-400 mt-2">{referralError}</p>
                  )}
                  {loyaltyInfo?.isEligible && stayData?.loyaltyDiscountEnabled !== false && (
                    <p className="text-[11px] text-[#F3EDE0]/60 mt-2 flex items-center gap-1.5">
                      <Sparkles size={12} /> Welcome back — {loyaltyInfo.discountPercent}% loyalty discount applied automatically.
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-end mb-8">
                  <span className="font-bold text-lg">Total payable</span>
                  <span className="text-4xl font-black tracking-tight">${totalPayable.toLocaleString()}</span>
                </div>

                {apiError && (
                  <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-sm mb-6 flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{apiError}</span>
                  </div>
                )}

                <button 
                  onClick={handleContinue}
                  disabled={submitting}
                  className="w-full bg-[#F3EDE0] text-[#433B31] font-black text-lg py-5 rounded-full flex items-center justify-center gap-3 hover:bg-white transition-colors disabled:opacity-70 shadow-[0_0_20px_rgba(243,237,224,0.3)]"
                >
                  {submitting ? <Loader2 size={24} className="animate-spin" /> : (
                    <>
                      Continue to Payment
                      <ArrowLeft size={20} className="rotate-180" />
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center opacity-50 uppercase tracking-widest font-bold mt-4">Free cancellation until {stayData?.startDate ? new Date(new Date(stayData.startDate).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}