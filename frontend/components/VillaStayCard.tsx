"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bed, Tag, Home, Users, Globe, Coffee, Backpack, ArrowRight, ArrowLeft, Wifi, MapPin, Sun, Wind, Music, TreePine } from "lucide-react";

const IconMap: Record<string, any> = { Home, Users, Globe, Coffee, Backpack, Wifi, MapPin, Sun, Wind, Music, TreePine };

type StayProps = {
  stay: {
    id: string;
    stayId: string;
    title: string;
    slotsTotal: number;
    slotsAvailable: number;
    priceUSDC: number;
    location?: string | null;
    shortDescription?: string | null;
    images?: string[] | null;
    heroImage?: string | null;
    amenityIcons?: any;
  };
};

export default function VillaStayCard({ stay }: StayProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = stay.images?.length ? stay.images : [stay.heroImage || "/images/dedenbangalore4.jpeg"];
  const soldOut = stay.slotsAvailable <= 0;

  const nextImage = () => {
    setImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="flex flex-col">
      {/* Stay Card */}
      <div className="flex flex-col md:flex-row w-full rounded-2xl overflow-hidden shadow-md h-auto md:h-[420px]">
        {/* Left: Info Panel */}
        <div className="bg-[#46392b] text-[#f7eedb] w-full md:w-[45%] p-10 flex flex-col justify-center relative">
          <div className="mb-2">
            <span
              className={`inline-block text-[#f7eedb] text-[8px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6 shadow-sm ${
                soldOut ? "bg-[#8a5a3f]" : "bg-[#869968]"
              }`}
            >
              {soldOut ? "Sold Out" : "Featured Stay"}
            </span>
            <h2 className="text-3xl md:text-[2.5rem] font-serif text-[#f7eedb] leading-tight mb-5" style={{ fontFamily: "Georgia, serif" }}>
              {stay.title}
            </h2>
            <div className="flex items-center gap-6 text-[#f7eedb]/80 text-[11px] font-semibold mb-6">
              <div className="flex items-center gap-2">
                <Bed size={14} />
                <span>
                  {soldOut ? "Fully booked" : `${stay.slotsAvailable} of ${stay.slotsTotal} spots left`}
                </span>
              </div>
              {stay.priceUSDC > 0 && (
                <div className="flex items-center gap-2">
                  <Tag size={14} />
                  <span>Starting at ${stay.priceUSDC}</span>
                </div>
              )}
            </div>
            <div className="w-full h-px bg-[#f7eedb]/10 mb-6"></div>
            {stay.shortDescription && (
              <p className="text-xs text-[#f7eedb]/70 font-medium leading-relaxed mb-8 pr-4 line-clamp-4">
                {stay.shortDescription}
              </p>
            )}
            {soldOut ? (
              <span className="inline-flex w-fit items-center justify-center bg-[#f7eedb]/30 text-[#f7eedb] font-black px-6 py-3 rounded-full uppercase tracking-widest text-[10px] cursor-not-allowed">
                Sold Out
              </span>
            ) : (
              <Link
                href={`/stay/${stay.stayId}`}
                className="inline-flex w-fit items-center justify-center bg-[#f7eedb] text-[#46392b] font-black px-6 py-3 rounded-full hover:bg-white transition-colors uppercase tracking-widest text-[10px]"
              >
                Book Stay ✦
              </Link>
            )}
          </div>
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
              className="w-8 h-8 rounded-full bg-[#46392b]/60 text-white flex items-center justify-center hover:bg-[#46392b] transition-colors border border-white/20 backdrop-blur-sm"
            >
              <ArrowLeft size={14} />
            </button>
            <button 
              onClick={nextImage}
              className="w-8 h-8 rounded-full bg-[#f7eedb] text-[#46392b] flex items-center justify-center hover:bg-white transition-colors shadow-sm"
            >
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Amenities Bar */}
      <div className="w-full bg-[#ebdcc2] rounded-xl mt-4 py-4 px-6 md:px-12 flex flex-wrap justify-between items-center shadow-sm">
        {(stay.amenityIcons && stay.amenityIcons.length > 0) ? (
          stay.amenityIcons.map((am: any, i: number) => {
            const IconComponent = IconMap[am.icon] || Home;
            return (
              <div key={i} className="flex items-center gap-1.5 md:gap-3 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
                <IconComponent size={22} className="text-[#46392b]/70" strokeWidth={1} />
                <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">{am.text}</span>
                {i < stay.amenityIcons!.length - 1 && (
                  <div className="hidden md:block w-px h-6 bg-[#46392b]/10 ml-6"></div>
                )}
              </div>
            );
          })
        ) : (
          // Default fallback
          <>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Home size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Cozy Spaces</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Users size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Good People</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Globe size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">New Stories</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
              <Coffee size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Slow Days</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
              <Backpack size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Lasting Memories</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
