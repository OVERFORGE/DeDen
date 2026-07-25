"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Home, Users, Globe, Coffee, Backpack, ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type StayData = {
  id: string;
  stayId: string;
  title: string;
  slug: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string;
  duration: number | null;
  priceUSDC: number;
  priceUSDT: number;
  slotsTotal: number;
  slotsAvailable: number;
  allowWaitlist: boolean;
  images: string[];
  heroImage?: string | null;
  amenities: string[];
  highlights: string[];
  rooms: any[];
};

export default function StayDetailsClient({ stay }: { stay: StayData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Steps: 1 = Booking specs, 2 = Contact info, 3 = Success
  const [step, setStep] = useState(1);
  
  // Step 1 State
  const [roomType, setRoomType] = useState('Private room');
  const [duration, setDuration] = useState(`7 Days 6 Night (Full stay) $${stay.priceUSDC || 100}`);
  // Pre-fill guests from URL query param
  const [occupancy, setOccupancy] = useState(() => {
    const guestsParam = searchParams.get('guests');
    return guestsParam && !isNaN(Number(guestsParam)) ? guestsParam : '2';
  });
  
  // Step 2 State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    gender: '',
    age: '',
    country: '',
    telegram: '',
    xHandle: ''
  });

  const [imageIndex, setImageIndex] = useState(0);
  const images = stay.images?.length > 0 ? stay.images : [stay.heroImage || "/images/dedenbangalore4.jpeg"];

  const nextImage = () => {
    setImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const submitApplication = () => {
    // Here we would typically submit to an API. 
    // For now, we'll just go to a success state or route to /apply
    alert("Booking application submitted successfully!");
    router.push('/villas');
  };

  const calculatedDuration = stay.duration || 
    Math.ceil((new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-[#f7eedb] py-16 px-6 sm:px-10 font-inter">
      <div className="max-w-[1000px] mx-auto">
        
        {/* Header Section */}
        <div className="relative mb-20">
          <div className="flex justify-between items-start">
            <div className="max-w-xl">
              <h1 className="text-[#43392e] leading-[0.8] flex flex-col mb-4">
                <span className="text-7xl md:text-8xl" style={{ fontFamily: "'Caveat', cursive" }}>
                  Live
                </span>
                <span className="font-display font-black text-6xl md:text-[5.5rem] tracking-wide mt-[-5px]">
                  STAYS
                </span>
              </h1>
              <p className="mt-8 text-xs text-[#43392e] font-semibold max-w-[280px] tracking-wide leading-relaxed opacity-80">
                Thoughtfully designed stays for every kind of traveller. Comfortable. Curated. Connected.
              </p>
            </div>
            
            {/* Circular badge */}
            <div className="hidden md:flex w-32 h-32 rounded-full items-center justify-center relative mt-4">
              <div className="absolute inset-0 rounded-full border border-dashed border-[#43392e]/40 m-1 rotate-12"></div>
              
              <svg viewBox="0 0 100 100" className="absolute w-[110%] h-[110%] top-[-5%] left-[-5%] animate-spin-slow" style={{ animationDuration: '20s' }}>
                <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
                <text className="text-[7.5px] tracking-widest font-bold uppercase" fill="#43392e">
                  <textPath href="#circlePath">
                    MORE THAN A STAY ✦ IT'S A MEMORY IN MOTION ✦ 
                  </textPath>
                </text>
              </svg>

              <div className="w-10 h-10 border-[3px] border-[#43392e] rounded-t-full border-b-0 mt-4"></div>
            </div>
          </div>
        </div>

        {/* Booking Card */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row w-full rounded-2xl overflow-hidden shadow-md h-auto md:h-[450px]">
            
            {/* Left: Dynamic Booking Form Panel */}
            <div className="bg-[#46392b] text-[#f7eedb] w-full md:w-[45%] p-10 flex flex-col justify-center relative">
              
              {step === 1 && (
                <div className="animate-fade-in w-full max-w-sm">
                  {/* Room Type Toggle */}
                  <div className="flex border border-[#f7eedb]/30 rounded-full w-fit mb-10 overflow-hidden text-xs font-bold">
                    <button 
                      onClick={() => setRoomType('Private room')}
                      className={`px-6 py-2.5 transition-colors ${roomType === 'Private room' ? 'bg-[#f7eedb] text-[#46392b]' : 'text-[#f7eedb]/70 hover:bg-[#f7eedb]/10'}`}
                    >
                      Private room
                    </button>
                    <button 
                      onClick={() => setRoomType('Dorm Room')}
                      className={`px-6 py-2.5 transition-colors ${roomType === 'Dorm Room' ? 'bg-[#f7eedb] text-[#46392b]' : 'text-[#f7eedb]/70 hover:bg-[#f7eedb]/10'}`}
                    >
                      Dorm Room
                    </button>
                  </div>

                  {/* Duration Dropdown */}
                  <div className="mb-8 relative">
                    <select 
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-sm px-5 py-3.5 rounded-xl appearance-none outline-none pr-10 cursor-pointer shadow-inner"
                    >
                      <option>{calculatedDuration} Days {calculatedDuration - 1} Night (Full stay) ${stay.priceUSDC || 100}</option>
                      <option>3 Days 2 Night (Weekend) ${Math.floor((stay.priceUSDC || 100)/2)}</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#46392b] pointer-events-none" />
                  </div>

                  {/* Occupancy Input */}
                  <div className="mb-12">
                    <label className="block text-[11px] font-bold text-[#f7eedb] mb-2 tracking-wide">
                      No. Occupancy
                    </label>
                    <input 
                      type="number" 
                      value={occupancy}
                      onChange={(e) => setOccupancy(e.target.value)}
                      className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-sm px-5 py-3.5 rounded-xl outline-none shadow-inner"
                    />
                  </div>

                  <button 
                    onClick={() => setStep(2)}
                    className="inline-flex w-fit items-center justify-center bg-[#f7eedb] text-[#46392b] font-black px-10 py-3.5 rounded-full hover:bg-white transition-colors uppercase tracking-widest text-[11px]"
                  >
                    Continue ✦
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="animate-fade-in w-full max-w-md space-y-4">
            
                  
                  <div>
                    <label className="block text-[10px] font-bold text-[#f7eedb] mb-1.5 tracking-wide">Name</label>
                    <input 
                      type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder={stay.location || "Devcon Mumbai"}
                      className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-xs px-4 py-3 rounded-lg outline-none placeholder:text-[#46392b]/40"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-[#f7eedb] mb-1.5 tracking-wide">Mail</label>
                    <input 
                      type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder={stay.location || "Devcon Mumbai"}
                      className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-xs px-4 py-3 rounded-lg outline-none placeholder:text-[#46392b]/40"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#f7eedb] mb-1.5 tracking-wide">Gender</label>
                      <input 
                        type="text" name="gender" value={formData.gender} onChange={handleInputChange} placeholder={stay.location || "Devcon Mumbai"}
                        className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-xs px-4 py-3 rounded-lg outline-none placeholder:text-[#46392b]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#f7eedb] mb-1.5 tracking-wide">Age</label>
                      <input 
                        type="text" name="age" value={formData.age} onChange={handleInputChange} placeholder={stay.location || "Devcon Mumbai"}
                        className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-xs px-4 py-3 rounded-lg outline-none placeholder:text-[#46392b]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#f7eedb] mb-1.5 tracking-wide">Country</label>
                      <input 
                        type="text" name="country" value={formData.country} onChange={handleInputChange} placeholder={stay.location || "Devcon Mumbai"}
                        className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-xs px-4 py-3 rounded-lg outline-none placeholder:text-[#46392b]/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#f7eedb] mb-1.5 tracking-wide">Telegram Handle</label>
                      <input 
                        type="text" name="telegram" value={formData.telegram} onChange={handleInputChange} placeholder={stay.location || "Devcon Mumbai"}
                        className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-xs px-4 py-3 rounded-lg outline-none placeholder:text-[#46392b]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#f7eedb] mb-1.5 tracking-wide">X Handle</label>
                      <input 
                        type="text" name="xHandle" value={formData.xHandle} onChange={handleInputChange} placeholder={stay.location || "Devcon Mumbai"}
                        className="w-full bg-[#f7eedb] text-[#46392b] font-bold text-xs px-4 py-3 rounded-lg outline-none placeholder:text-[#46392b]/40"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={submitApplication}
                    className="inline-flex w-fit items-center justify-center bg-[#f7eedb] text-[#46392b] font-black px-10 py-3.5 rounded-full hover:bg-white transition-colors uppercase tracking-widest text-[11px]"
                  >
                    Continue ✦
                  </button>
                </div>
              )}
            </div>

            {/* Right: Image Panel */}
            <div className="relative w-full md:w-[55%] h-72 md:h-full">
              <Image
                src={images[imageIndex]}
                alt={stay.title}
                fill
                className="object-cover"
              />
              {/* Navigation Buttons overlay (functional) */}
              <div className="absolute bottom-6 right-6 flex gap-2">
                <button 
                  onClick={prevImage}
                  className="w-10 h-10 rounded-full bg-[#46392b]/60 text-white flex items-center justify-center hover:bg-[#46392b] transition-colors border border-white/20 backdrop-blur-sm"
                >
                  <ArrowLeft size={16} />
                </button>
                <button 
                  onClick={nextImage}
                  className="w-10 h-10 rounded-full bg-[#f7eedb] text-[#46392b] flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Amenities Bar */}
          <div className="w-full bg-[#ebdcc2] rounded-xl py-5 px-6 md:px-12 flex flex-wrap justify-between items-center shadow-sm">
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Home size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[8px] font-black text-[#46392b]/70 uppercase tracking-widest">Cozy Spaces</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Users size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[8px] font-black text-[#46392b]/70 uppercase tracking-widest">Good People</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Globe size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[8px] font-black text-[#46392b]/70 uppercase tracking-widest">New Stories</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
              <Coffee size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[8px] font-black text-[#46392b]/70 uppercase tracking-widest">Slow Days</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
              <Backpack size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[8px] font-black text-[#46392b]/70 uppercase tracking-widest">Lasting Memories</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
