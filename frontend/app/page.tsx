"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Calendar, Search, Users, ChevronDown, Minus, Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";

function MarqueeBanner() {
  const items = ["MEET", "TRAVEL", "STAY", "REPEAT", "MEET", "TRAVEL", "STAY", "REPEAT", "MEET", "TRAVEL", "STAY", "REPEAT", "MEET", "TRAVEL", "STAY", "REPEAT"];
  return (
    <div className="bg-[#2c331f] text-[#f7eedb] py-4 overflow-hidden w-full border-t-2 border-[#2c331f]">
      <div className="flex -gap-10 animate-marquee whitespace-nowrap items-center">
        {items.map((item, i) => (
          <span key={i} className="mx-6 md:mx-10 flex items-center gap-12 md:gap-10 text-lg md:text-3xl font-black tracking-widest uppercase font-display">
            {item}
            <span className="text-[#e8c37b] text-base md:text-2xl">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string; }) {
  return (
    <div className="bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl p-5 flex flex-col gap-3 shadow-[4px_4px_0px_0px_#2c331f] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#2c331f]">
      <div className="w-10 h-12 rounded-t-full rounded-b-md bg-[#e8c37b] border-2 border-[#2c331f] flex items-center justify-center text-[#2c331f]">
        {icon}
      </div>
      <h4 className="font-bold text-[#2c331f] text-base">{title}</h4>
      <p className="text-[#2c331f] text-xs leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function formatDateRange(startDateStr?: string, endDateStr?: string) {
  if (!startDateStr || !endDateStr) return "";
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  } else {
    return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
  }
}

function StayCard({ image, location, event, price, href, startDate, endDate }: { image: string; location: string; event: string; price: string; href: string; startDate?: string; endDate?: string; }) {
  const dateRange = formatDateRange(startDate, endDate);
  const bannerText = dateRange ? `${location} ${dateRange}` : location;

  return (
    <div className="bg-[#9db47d] border-2 border-[#2c331f] rounded-2xl overflow-hidden transition-all shadow-[4px_4px_0px_0px_#2c331f] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#2c331f] group flex flex-col">
      <div className="relative h-48 overflow-hidden border-b-2 border-[#2c331f]">
        <Image src={image} alt={event} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="font-caveat font-extrabold text-[12px] absolute top-4 left-[-10px] bg-[#e8c37b] text-[#2c331f] text-[10px] font-bold px-4 py-1.5 rounded-full border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] rotate-[-5deg] tracking-wider">
          {bannerText}
        </div>
      </div>
      <div className="p-4 pt-5 pb-6 flex flex-col">
        <p className="text-[#2c331f] font-black text-xl font-display tracking-wide leading-tight">{event}</p>
        <p className="text-[#f7eedb] text-[11px] font-bold mt-1 tracking-widest opacity-90 uppercase">{price}</p>
        <div className="mt-5">
          <Link href={href} className="inline-block bg-[#f7eedb] text-[#2c331f] text-[11px] font-bold py-2.5 px-6 rounded-full border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] hover:bg-white transition-colors">
            Book a stay
          </Link>
        </div>
      </div>
    </div>
  );
}

const PartnerCard = () => (
  <div className="bg-white rounded-xl w-[100px] h-[64px] sm:w-[120px] sm:h-[72px] md:w-[140px] md:h-[80px] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:scale-105 transition-transform duration-300">
    <div className="font-black text-[#1A1A1A] text-sm sm:text-base md:text-lg flex items-center tracking-wide">
      BYB<span className="text-[#f7a600] mx-[1px] md:mx-[2px]">|</span>T
    </div>
  </div>
);

interface StayOption {
  id: string;
  stayId: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  priceUSDC: number;
  slug: string;
}

function HeroSearch({ stays }: { stays: StayOption[] }) {
  const [selectedStay, setSelectedStay] = useState<StayOption | null>(null);
  const [guests, setGuests] = useState(2);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRef<any>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleFindStay = () => {
    if (!selectedStay) {
      setDropdownOpen(true);
      return;
    }
    window.location.href = `/stay/${selectedStay.stayId}?guests=${guests}`;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="relative max-w-[420px]">
      {/* Overlapping banner text */}
      <div className="absolute -top-3 left-6 bg-white px-2 z-10 border border-white">
        <span className="font-caveat font-extrabold text-[#7b9459] text-[14px] italic  tracking-wide block pt-0.5">Find your bunk ? ✦</span>
      </div>

      <div className="bg-white border-2 border-[#2c331f] rounded-3xl shadow-[4px_4px_0px_0px_#2c331f] p-4 pt-5 flex flex-col gap-3">
        <div className="flex gap-3">
          {/* Stay Dropdown */}
          <div className="flex-1 relative" ref={dropdownRef}>
            <button
              id="hero-stay-dropdown"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full h-11 flex items-center justify-between bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl px-3 transition-colors hover:bg-[#ede3c9]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin size={14} className="text-[#2c331f] shrink-0" />
                <span className="text-xs font-bold text-[#2c331f] truncate">
                  {selectedStay ? selectedStay.title : <span className="opacity-60">Event or City</span>}
                </span>
              </div>
              <ChevronDown size={14} className={`text-[#2c331f] shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom Dropdown Panel */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-[#2c331f] rounded-2xl shadow-[4px_4px_0px_0px_#2c331f] z-50 overflow-hidden">
                {stays.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-xs font-bold text-[#2c331f] opacity-60">No active stays right now.</p>
                  </div>
                ) : (
                  stays.map((stay) => (
                    <button
                      key={stay.id}
                      id={`stay-option-${stay.stayId}`}
                      onClick={() => { setSelectedStay(stay); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 flex flex-col gap-0.5 hover:bg-[#f7eedb] transition-colors border-b border-[#2c331f]/10 last:border-0 ${
                        selectedStay?.id === stay.id ? 'bg-[#f7eedb]' : ''
                      }`}
                    >
                      <span className="text-xs font-black text-[#2c331f] leading-tight">{stay.title}</span>
                      <span className="text-[10px] font-semibold text-[#5a6b3a] flex items-center gap-1">
                        <MapPin size={10} /> {stay.location}
                        &nbsp;·&nbsp;
                        <Calendar size={10} /> {formatDate(stay.startDate)} – {formatDate(stay.endDate)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Guest counter */}
          <div className="w-[110px] h-11 flex items-center justify-between bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl px-2 gap-1">
            <button
              id="hero-guests-minus"
              onClick={() => setGuests(g => Math.max(1, g - 1))}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-[#2c331f] text-[#f7eedb] hover:bg-[#3a4f26] transition-colors shrink-0"
            >
              <Minus size={10} strokeWidth={3} />
            </button>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-[#2c331f] opacity-60">Guests</span>
              <span className="text-sm font-black text-[#2c331f]">{guests}</span>
            </div>
            <button
              id="hero-guests-plus"
              onClick={() => setGuests(g => Math.min(20, g + 1))}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-[#2c331f] text-[#f7eedb] hover:bg-[#3a4f26] transition-colors shrink-0"
            >
              <Plus size={10} strokeWidth={3} />
            </button>
          </div>
        </div>

        <button
          id="hero-find-stay"
          onClick={handleFindStay}
          className={`w-full font-bold text-sm py-3.5 rounded-xl border-2 border-[#2c331f] transition-all shadow-[2px_2px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-x-[2px] hover:translate-y-[2px] ${
            selectedStay
              ? 'bg-[#9db47d] text-[#2c331f] hover:bg-[#8ca36c]'
              : 'bg-[#2c331f] text-[#f7eedb] hover:bg-[#3a4f26]'
          }`}
        >
          {selectedStay ? 'Find stays ✦' : 'Pick an event first ✦'}
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [liveStays, setLiveStays] = useState<any[]>([]);
  const [loadingStays, setLoadingStays] = useState(true);

  useEffect(() => { 
    window.scrollTo(0, 0); 
    
    // Fetch live stays
    fetch('/api/stays')
      .then(res => res.json())
      .then(data => {
        setLiveStays(data);
        setLoadingStays(false);
      })
      .catch(err => {
        console.error("Error fetching stays:", err);
        setLoadingStays(false);
      });
  }, []);

  const partners = ["#zkWeek","DevCon","web Summit","ETHGlobal","EthIndia","BUIDL","Solana"];
  const stats = [
    { value: "38", label: "Events Hosted" },
    { value: "12", label: "Cities Covered" },
    { value: "4,200+", label: "Builder Nights" },
    { value: "60+", label: "Teams Stayed" },
  ];

  return (
    <div className="bg-[#F2EDE4] text-[#2B3B1A]">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#f7eedb] pt-12 pb-0 min-h-[90vh] flex flex-col">
        {/* Background shapes */}
        <div className="absolute top-0 right-10 w-64 h-96 bg-[#ede3c9] rounded-full opacity-50 z-0 hidden md:block"></div>
        <div className="absolute top-10 -left-10 w-32 h-6 bg-[#d8a47f] rounded-full opacity-80 z-0"></div>
        <div className="absolute top-20 -left-4 w-24 h-4 bg-[#d8a47f] rounded-full opacity-60 z-0"></div>

        <div className="max-w-[1100px] mx-auto px-6 w-full flex-1 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 z-10 relative">
          
          {/* Left Column */}
          <div className="flex flex-col w-full md:w-[52%] pt-4 md:pt-10">
            <div className="relative items-center gap-2 mb-2 rotate-[-3deg] origin-left top-4 left-1">
              <span className="font-caveat font-extrabold text-md italic  text-[#7e9154] tracking-wider">popup hostels for event season ✦</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl lg:text-[5.5rem] font-black text-[#2c331f] leading-[0.95] tracking-tight mb-8 font-display">
              Crash the<br />
              <span className="relative inline-block mt-2 text-[#7b9459]">
                conference
                {/* SVG for the hand-drawn circle */}
                <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[130%] text-[#a68a61] pointer-events-none" viewBox="0 0 200 60" fill="none" preserveAspectRatio="none">
                  <path d="M10,30 Q40,5 100,5 T190,30 Q160,55 100,55 T10,30 Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M15,35 Q45,10 100,10 T185,35 Q155,60 100,60 T15,35 Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>
            
            <p className="text-[#2c331f] text-sm md:text-base leading-relaxed mb-10 max-w-md font-medium">
The best part of any conference isn't on the schedule. It's the stranger you meet in the kitchen at midnight, the pitch you refine over breakfast, the friend you didn't know you were flying in to make. We take over villas and entire hostels near the biggest Web3 events so that part of the trip has somewhere to happen.            </p>
            
            {/* Search Box */}
            <HeroSearch stays={liveStays} />
          </div>

          {/* Right Column - Illustration */}
          <div className="relative w-full md:w-[48%] flex justify-center md:justify-center mt-10 md:mt-0 -ml-4 md:-ml-8">
            <div className="relative w-full max-w-[480px] aspect-[4/3] rotate-2">
              <div className="absolute inset-0 bg-white border-2 border-[#2c331f] rounded-3xl shadow-[8px_8px_0px_0px_#2c331f] overflow-hidden p-2">
                <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-[#2c331f]">
                  <Image src="/images/dedenbangalore4.jpeg" alt="DeDen illustration" fill className="object-cover" sizes="500px" />
                </div>
              </div>
              
              {/* Green badge */}
              <div className="absolute -top-6 -right-1 w-24 h-24 bg-[#7b9459] text-[#fbf4e5] rounded-full flex flex-col items-center justify-center border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] -rotate-[15deg] z-20">
                <span className="font-caveat font-extrabold text-center text-[20px] leading-tight">
                  grab a<br/>bunk ✦
                </span>
                
              </div>
              
              {/* Yellow banner overlapping bottom left */}
              <div className="absolute bottom-4 left-3 bg-[#e8c37b] border-2 border-black rounded-xl px-4 py-1  rotate-[-5deg] z-20">
                <span className="font-caveat font-extrabold text-black text-[18px] tracking-widest">
                  the common room, 11pm
                </span>
              </div>

              <div className="absolute -bottom-9 -left-6 bg-[#fbf5e7] border-2 border-black rounded-xl px-2 py-3  rotate-[5deg] z-20 shadow-[2px_2px_0px_0px_#2c331f]">
                <span className="font-caveat font-extrabold text-[#b4623b] text-[18px] tracking-widest">
                  ROOM 302 ✦ CHECK IN & CHILL
                </span>
              </div>
              
              
            </div>
          </div>
        </div>
        
        <div className="mt-16 border-t-2 border-[#2c331f]"><MarqueeBanner /></div>
      </section>

      {/* ── We host the underground ───────────────────────────────────────────── */}
      <section className="bg-[#f7eedb] py-16 md:py-24 text-[#2c331f]">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 md:gap-8 mb-16">
            
            {/* Left Column */}
            <div className="flex flex-col w-full md:w-[50%]">
              <p className="font-caveat font-extrabold text-[24px] italic text-[#7e9154] tracking-wider mb-2 -rotate-[3deg]  ">who we are</p>
              <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-[#2c331f] leading-[0.95] tracking-tight mb-6 font-display">
                We host the<br />underground.
              </h2>
              <p className="text-[#2c331f] text-sm leading-relaxed mb-4 font-medium">
                 DeDen started because we kept showing up to conferences and going home the same way we came a badge, some business cards, a hotel room we barely used. So we started renting the villa instead. Then the whole hostel. Now it's how we travel, and how a growing crew of makers, creators and doers travels with us.
              </p>
              <p className="text-[#2c331f] text-sm leading-relaxed mb-6 font-medium">
                Villa or hostel, the idea's the same: we take over the whole property, not just a few rooms, so every hallway and common room belongs to the Den. Nobody's a guest in someone else's stay, everyone's home for the week.
              </p>
              <p className="text-[#2c331f] text-sm leading-relaxed mb-6 font-medium">
                The panels end at 6. The real conversations start after. That's what we're building around, not a room to sleep in, but a crew to land with.
              </p>
              <Link href="/#about" className="font-caveat font-extrabold text-[18px] inline-flex items-center gap-2 text-[#d04639]  hover:opacity-80 transition-opacity uppercase tracking-widest">
                read our story ✦ stay awhile
              </Link>
            </div>
            
            {/* Right Column - Polaroid Image */}
            <div className="w-full md:w-[45%] flex justify-center mt-6 md:mt-0">
              <div className="relative w-full max-w-[340px] bg-white p-3 pb-12 rounded-sm shadow-[6px_6px_0px_0px_#2c331f] border-2 border-[#2c331f] rotate-2">
                
                {/* Tape top left */}
                <div className="absolute -top-3 -left-4 w-14 h-6 bg-[#e8c37b]/90 rotate-[-15deg] z-10 border border-[#2c331f] shadow-sm"></div>
                {/* Tape top right */}
                <div className="absolute -top-2 -right-4 w-12 h-6 bg-[#e8c37b]/90 rotate-[25deg] z-10 border border-[#2c331f] shadow-sm"></div>
                
                <div className="relative w-full aspect-[4/3] border-2 border-[#2c331f] overflow-hidden rounded-sm">
                  <Image src="/images/dedenbangalore2.jpeg" alt="DeDen community" fill className="object-cover" />
                </div>
                
                {/* Handwritten caption */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full text-center">
                   <p className="text-[#2c331f] text-xl font-bold" style={{ fontFamily: "'Caveat', cursive" }}>getting it down right in Bali</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<MapPin size={18} strokeWidth={2.5} />} 
              title="Stays near" 
              description="Show up, pay in crypto or fiat, and someone already knows your name at check-in. We handle the logistics so your only job is to be there." 
            />
            <FeatureCard 
              icon={<Users size={18} strokeWidth={2.5} />} 
              title="Instant crew" 
              description="No icebreakers, no small talk. Every Den fills up with people already building something, you just have to walk into the kitchen." 
            />
            <FeatureCard 
              icon={<Calendar size={18} strokeWidth={2.5} />} 
              title="Hot & Flexible" 
              description="Landing last-minute? Staying an extra week because the conversation isn't done? We move with you, because that's usually how the good trips go." 
            />
          </div>
        </div>
      </section>

      {/* ── Live Stays ────────────────────────────────────────────────────────── */}
      <section className="bg-[#efe2c6] py-16 md:py-24 border-b-2 border-t-2 border-[#2c331f]">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
            <div className="flex flex-col gap-1">
              <span className="font-caveat font-extrabold text-[24px] italic text-[#7e9154] tracking-wider mb-2 rotate-[-3deg]">book a habit</span>
              <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-[#2c331f] leading-[0.95] tracking-tight font-display">
                Live Stays
              </h2>
            </div>
           
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {loadingStays ? (
              <div className="col-span-1 sm:col-span-2 md:col-span-3 flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-[#2c331f]/20 border-t-[#2c331f] rounded-full animate-spin"></div>
              </div>
            ) : liveStays.length > 0 ? (
              liveStays.map((stay) => (
                <StayCard 
                  key={stay.id}
                  image={stay.images?.[0] || stay.heroImage || "/images/dedenbangalore1.jpeg"}
                  location={stay.location || stay.title}
                  event={stay.title}
                  price={`Starts at ${stay.priceUSDC || 310} USDC / week`}
                  href={`/stay/${stay.stayId}`}
                  startDate={stay.startDate}
                  endDate={stay.endDate}
                />
              ))
            ) : (
              <div className="col-span-1 sm:col-span-2 md:col-span-3 text-center py-12">
                <p className="text-[#2c331f] font-bold text-lg">No active stays right now. Check back soon!</p>
              </div>
            )}
          </div>
          
          <div className="text-center mt-12 flex justify-center">
             <Link href="/villas" className="font-caveat font-extrabold text-[24px] inline-block text-[#8ca36c] pb-1 border-b border-[#8ca36c] hover:text-[#2c331f] hover:border-[#2c331f] transition-colors italic tracking-widest ">
               + check more popups in our timeline +
             </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#9db47d] py-20 relative overflow-hidden">
        <div className="absolute top-0 -left-10 text-[250px] font-black text-[#8ca36c] opacity-30 leading-none font-display pointer-events-none">O</div>
        
        <div className="max-w-[1000px] mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-[#2c331f] mb-2 font-display tracking-tight">
            Two years of showing up.
          </h2>
          <p className="font-caveat font-extrabold text-[18px]  italic  text-[#5a6b3a] tracking-widest mb-16">
            more than just a stay ✦
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24">
            
            {/* Stat 1 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">3</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="font-caveat font-extrabold text-[18px] text-[#5a6b3a] italic tracking-widest">super hosts</p>
            </div>
            
            {/* Stat 2 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">3</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="font-caveat font-extrabold text-[18px] text-[#5a6b3a] italic tracking-widest">cities covered</p>
            </div>

            {/* Stat 3 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">200+</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="font-caveat font-extrabold text-[18px] text-[#5a6b3a] italic tracking-widest">founders met</p>
            </div>

            {/* Stat 4 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">60+</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="font-caveat font-extrabold text-[18px] text-[#5a6b3a] italic tracking-widest">events powered</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Community Partners ────────────────────────────────────────────────── */}
      <section className="bg-[#f6ebd8] py-20 overflow-hidden relative">
        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');
          .font-handwriting { font-family: 'Caveat', cursive; }
        `}} />
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8">
          
          {/* Left Text */}
          <div className="relative w-full lg:w-auto flex flex-col items-center lg:items-start z-10 lg:pl-10 lg:pr-12 flex-shrink-0">
            <h2 className="relative flex flex-col items-center lg:items-start">
              <span className="font-caveat font-extrabold  text-[3.5rem] md:text-[5.5rem] text-[#5c3826] rotate-[-4deg] absolute -top-8 -left-2 md:-top-16 md:-left-8 whitespace-nowrap z-0 tracking-wide opacity-90">
                COMMUNITY
              </span>
              <span className="font-display font-black text-6xl md:text-[5.5rem] text-[#2c331f] tracking-tight relative z-10 pt-4 md:pt-6">
                Partners
              </span>
            </h2>
          </div>

          {/* Right Cards Grid with Mask Effect */}
          <div 
            className="w-full lg:w-auto flex justify-center lg:justify-end gap-4 sm:gap-5 md:gap-6 relative z-10 py-10 px-4 md:px-10"
            style={{ 
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)', 
              maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)' 
            }}
          >
            
            {/* Column 1 (Offset) */}
            <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 mt-[40px] sm:mt-[46px] md:mt-[52px]">
               <PartnerCard />
               <PartnerCard />
            </div>

            {/* Column 2 (Normal) */}
            <div className="flex flex-col gap-4 sm:gap-5 md:gap-6">
               <PartnerCard />
               <PartnerCard />
               <PartnerCard />
            </div>

            {/* Column 3 (Offset) */}
            <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 mt-[40px] sm:mt-[46px] md:mt-[52px]">
               <PartnerCard />
               <PartnerCard />
            </div>

            {/* Column 4 (Normal) */}
            <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 hidden sm:flex">
               <PartnerCard />
               <PartnerCard />
               <PartnerCard />
            </div>

          </div>
        </div>
      </section>

      {/* ── Partners ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#f7eedb] py-20 md:py-24 overflow-hidden text-[#2c331f]">
        <div className="max-w-[1000px] mx-auto px-6 text-center">
          <p className="font-caveat font-extrabold text-[24px] italic  text-[#7e9154] tracking-wider mb-2 rotate-[-3deg]">in good company</p>
          <h2 className="text-5xl md:text-6xl font-black text-[#2c331f] mb-6 font-display leading-tight">
            Backed by the crews we <br /> crash with.
          </h2>
          <p className="text-[#2c331f] text-sm md:text-base max-w-xl mx-auto mb-16 font-medium leading-relaxed">
            No less things than proper finding UI elements your users have a focus on. To better avoid this feeling and actually breaking a habit here, I place some copy in this blank UI.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-8 max-w-3xl mx-auto">
            {partners.map((p, i) => {
              const rotations = ["rotate-[-2deg]", "rotate-[3deg]", "rotate-[-4deg]", "rotate-[1deg]", "rotate-[4deg]", "rotate-[-1deg]", "rotate-[2deg]"];
              const rotation = rotations[i % rotations.length];
              return (
                <span key={p} className={`bg-[#f7eedb] text-[#2c331f] font-bold text-sm px-6 py-3 rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#2c331f] uppercase tracking-wider ${rotation} hover:bg-white transition-colors cursor-default`}>
                  {p}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA: Host an event ────────────────────────────────────────────────── */}
      <section className="bg-[#2c331f] py-20 md:py-28 relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-10 right-[15%] w-12 h-12 bg-[#a68a61] rounded-full opacity-80" />
        <div className="absolute -left-10 top-1/4 w-32 h-6 bg-[#4A5C2F] rounded-full opacity-40" />
        <div className="absolute -left-4 top-[30%] w-24 h-4 bg-[#4A5C2F] rounded-full opacity-30" />
        
        {/* Large faint background letters */}
        <div className="absolute -bottom-20 -left-10 text-[300px] font-black text-[#f7eedb] opacity-[0.03] leading-none font-display pointer-events-none">D</div>
        
        <div className="max-w-[800px] mx-auto px-6 relative z-10 text-center flex flex-col items-center">
          <p className="font-caveat font-extrabold text-[24px] italic font-bold text-[#f7eedb] tracking-wider mb-4 opacity-70">host a den ✦</p>
          <h2 className="text-5xl md:text-[5rem] font-black text-[#f7eedb] leading-[1] mb-6 font-display tracking-tight text-center">
            Host an event<br />In DeDen
          </h2>
          <p className="text-[#f7eedb] text-sm md:text-base max-w-md mx-auto mb-10 font-medium leading-relaxed opacity-90 text-center">
            Drop your email and we'll hit you back within 24 hours. We keep it strictly confidential. Limited spots per event.
          </p>
          
          <div className="flex flex-col items-center gap-4 w-full">
             <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center">
                <input 
                  type="text" 
                  placeholder="Your name" 
                  className="w-full sm:w-[50%] bg-[#f7eedb] text-[#2c331f] placeholder-[#2c331f]/50 px-6 py-3.5 rounded-xl border-none outline-none font-bold text-sm text-center shadow-inner" 
                />
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full sm:w-[50%] bg-[#f7eedb] text-[#2c331f] placeholder-[#2c331f]/50 px-6 py-3.5 rounded-xl border-none outline-none font-bold text-sm text-center shadow-inner" 
                />
             </div>
             <button className="bg-[#9db47d] text-[#2c331f] px-8 py-2.5 rounded-tr-xl rounded-tl-md rounded-br-md rounded-bl-xl font-bold text-sm hover:bg-[#8ca36c] transition-colors border-2 border-transparent mt-2 border-[#2c331f] border-2">
               Submit
             </button>
             <p className="font-caveat font-extrabold text-[18px] italic text-[#f7eedb]/50  mt-2 tracking-widest  font-bold">
               Your details are secure with us
             </p>
          </div>
        </div>
      </section>

    </div>
  );
}
