"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Calendar, Search, Users } from "lucide-react";
import { useState, useEffect } from "react";

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

function StayCard({ image, location, event, price, href }: { image: string; location: string; event: string; price: string; href: string; }) {
  return (
    <div className="bg-[#9db47d] border-2 border-[#2c331f] rounded-2xl overflow-hidden transition-all shadow-[4px_4px_0px_0px_#2c331f] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#2c331f] group flex flex-col">
      <div className="relative h-48 overflow-hidden border-b-2 border-[#2c331f]">
        <Image src={image} alt={location} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-4 left-[-10px] bg-[#e8c37b] text-[#2c331f] text-[10px] font-bold px-4 py-1.5 rounded-full border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] rotate-[-5deg] uppercase tracking-wider">
          DevCon ✦ Nov 5-11
        </div>
      </div>
      <div className="p-4 pt-5 pb-6 flex flex-col">
        <p className="text-[#2c331f] font-black text-xl font-display tracking-wide leading-tight">{location}</p>
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
              <span className="text-md italic font-bold text-[#7e9154] tracking-wider">popup hostels for event season ✦</span>
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
              No less things than proper finding UI elements your users have a focus on. To better avoid this feeling and actually breaking a habit here, I place some copy in this blank UI.
            </p>
            
            {/* Search Box */}
            <div className="relative max-w-[420px]">
              {/* Overlapping banner text */}
              <div className="absolute -top-3 left-6 bg-white px-2 z-10 border border-white">
                <span className="text-[#7b9459] text-[11px] italic font-bold tracking-wide block pt-0.5">Find your bunk ? ✦</span>
              </div>
              
              <div className="bg-white border-2 border-[#2c331f] rounded-3xl shadow-[4px_4px_0px_0px_#2c331f] p-4 pt-5 flex flex-col gap-3">
                <div className="flex gap-3">
                   <div className="flex-1 flex items-center justify-between bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2">
                         <MapPin size={16} className="text-[#2c331f] shrink-0" />
                         <span className="text-xs font-bold text-[#2c331f] opacity-70">Event or City</span>
                      </div>
                   </div>
                   <div className="w-[100px] flex items-center justify-between bg-[#f7eedb] border-2 border-[#2c331f] rounded-xl px-3 py-2.5">
                      <span className="text-xs font-bold text-[#2c331f] opacity-70">Guests</span>
                      <span className="text-xs font-bold text-[#2c331f]">2</span>
                   </div>
                </div>
                <button className="w-full bg-[#9db47d] text-[#2c331f] font-bold text-sm py-3.5 rounded-xl border-2 border-[#2c331f] hover:bg-[#8ca36c] transition-colors shadow-[2px_2px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f]">
                  Find stays ✦
                </button>
              </div>
            </div>
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
                <span className="text-center font-bold text-[14px] leading-tight">
                  grab a<br/>bunk ✦
                </span>
                
              </div>
              
              {/* Yellow banner overlapping bottom left */}
              <div className="absolute bottom-4 left-3 bg-[#e8c37b] border-2 border-black rounded-xl px-4 py-1  rotate-[-5deg] z-20">
                <span className="text-black text-[14px] font-bold tracking-widest">
                  the common room, 11pm
                </span>
              </div>

              <div className="absolute -bottom-9 -left-6 bg-[#fbf5e7] border-2 border-black rounded-xl px-2 py-3  rotate-[5deg] z-20 shadow-[2px_2px_0px_0px_#2c331f]">
                <span className="text-[#b4623b] text-[14px] font-bold tracking-widest">
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
              <p className="text-sm italic font-bold text-[#7e9154] tracking-wider mb-2">who we are</p>
              <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-[#2c331f] leading-[0.95] tracking-tight mb-6 font-display">
                We host the<br />underground.
              </h2>
              <p className="text-[#2c331f] text-sm leading-relaxed mb-4 font-medium">
                DeDen is a global, floating home away from home. We take over luxury villas and fill them with makers, creators and doers traveling to conference cities.
              </p>
              <p className="text-[#2c331f] text-sm leading-relaxed mb-6 font-medium">
                We curate intimate pop-ups where the real conversations happen, right after the panels end. You're not booking a room, you're finding a crew.
              </p>
              <Link href="/#about" className="inline-flex items-center gap-2 text-[#d04639] font-bold text-xs hover:opacity-80 transition-opacity uppercase tracking-widest">
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
              description="Pick your event, pick your room, pay in crypto or fiat. We handle the rest so you can focus on building." 
            />
            <FeatureCard 
              icon={<Users size={18} strokeWidth={2.5} />} 
              title="Instant crew" 
              description="Every Den is a curated group. You're not booking a room, you're joining a community of makers who get it." 
            />
            <FeatureCard 
              icon={<Calendar size={18} strokeWidth={2.5} />} 
              title="Hot & Flexible" 
              description="Short stays, long stays, last-minute rooms. We move as fast as you do, because conference season waits for no one." 
            />
          </div>
        </div>
      </section>

      {/* ── Live Stays ────────────────────────────────────────────────────────── */}
      <section className="bg-[#efe2c6] py-16 md:py-24 border-b-2 border-t-2 border-[#2c331f]">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-sm italic font-bold text-[#7e9154] tracking-wider mb-2">book a habit</span>
              <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-[#2c331f] leading-[0.95] tracking-tight font-display">
                Live Stays
              </h2>
            </div>
            <p className="text-[#2c331f] text-sm md:text-base max-w-sm leading-relaxed font-medium text-left md:text-right">
              You're getting full house amenities plus the camaraderie of your local crew in a place where it goes.
            </p>
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
                />
              ))
            ) : (
              <div className="col-span-1 sm:col-span-2 md:col-span-3 text-center py-12">
                <p className="text-[#2c331f] font-bold text-lg">No active stays right now. Check back soon!</p>
              </div>
            )}
          </div>
          
          <div className="text-center mt-12 flex justify-center">
             <Link href="/villas" className="inline-block text-[#8ca36c] text-sm font-bold pb-1 border-b border-[#8ca36c] hover:text-[#2c331f] hover:border-[#2c331f] transition-colors italic tracking-widest uppercase">
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
          <p className="text-xs italic font-bold text-[#5a6b3a] tracking-widest mb-16">
            more than just a stay ✦
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24">
            
            {/* Stat 1 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">38</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="text-[#5a6b3a] text-[11px] italic font-bold uppercase tracking-widest">super hosts</p>
            </div>
            
            {/* Stat 2 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">12</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="text-[#5a6b3a] text-[11px] italic font-bold uppercase tracking-widest">cities covered</p>
            </div>

            {/* Stat 3 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">4,200+</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="text-[#5a6b3a] text-[11px] italic font-bold uppercase tracking-widest">founders met</p>
            </div>

            {/* Stat 4 */}
            <div className="flex flex-col items-center">
              <p className="text-[#2c331f] text-6xl md:text-[5.5rem] font-black tracking-tighter mb-4 font-display leading-none drop-shadow-sm">60+</p>
              <div className="w-12 h-1 bg-[#2c331f] mb-4"></div>
              <p className="text-[#5a6b3a] text-[11px] italic font-bold uppercase tracking-widest">events powered</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Partners ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#f7eedb] py-20 md:py-24 overflow-hidden text-[#2c331f]">
        <div className="max-w-[1000px] mx-auto px-6 text-center">
          <p className="text-sm italic font-bold text-[#7e9154] tracking-wider mb-2 rotate-[-3deg]">in good company</p>
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
          <p className="text-sm italic font-bold text-[#f7eedb] tracking-wider mb-4 opacity-70">host a den ✦</p>
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
             <p className="text-[#f7eedb]/50 text-[10px] mt-2 tracking-widest uppercase font-bold">
               Your details are secure with us
             </p>
          </div>
        </div>
      </section>

    </div>
  );
}
