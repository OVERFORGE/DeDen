"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, ArrowRight, MapPin, Wind, Wifi, Droplet, 
  Sparkles, Monitor, BatteryCharging, Shirt, Lock, Plane, 
  Train, ShoppingBag, Hospital, Mountain
} from "lucide-react";

type Room = {
  id?: string;
  name: string;
  description: string;
  capacity: number;
  priceUSDC: number;
  priceUSDT: number;
  images: string[];
  amenities: string[];
  beds?: string;
  area?: string;
  roomsLeft?: number;
};

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
  rules: string[];
  address?: {
    mapUrl?: string;
    fullAddress?: string;
    landmarks?: { name: string; distance: string; type: string }[];
  } | null;
  rooms: Room[];
};

export default function StayDetailsClient({ stay }: { stay: StayData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [imageIndex, setImageIndex] = useState(0);
  const images = stay.images?.length > 0 ? stay.images : [stay.heroImage || "/images/dedenbangalore4.jpeg"];
  
  const nextImage = () => setImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setImageIndex((prev) => (prev - 1 + images.length) % images.length);

  // Icon mapper
  const getAmenityIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('wifi') || lower.includes('internet')) return <Wifi size={28} strokeWidth={1.5} />;
    if (lower.includes('air') || lower.includes('ac')) return <Wind size={28} strokeWidth={1.5} />;
    if (lower.includes('water') || lower.includes('hot')) return <Droplet size={28} strokeWidth={1.5} />;
    if (lower.includes('desk') || lower.includes('work')) return <Monitor size={28} strokeWidth={1.5} />;
    if (lower.includes('power') || lower.includes('backup')) return <BatteryCharging size={28} strokeWidth={1.5} />;
    if (lower.includes('laundry') || lower.includes('wash') || lower.includes('clean')) return <Shirt size={28} strokeWidth={1.5} />;
    if (lower.includes('lock') || lower.includes('safe') || lower.includes('secure')) return <Lock size={28} strokeWidth={1.5} />;
    if (lower.includes('housekeeping') || lower.includes('daily')) return <Sparkles size={28} strokeWidth={1.5} />;
    return <Sparkles size={28} strokeWidth={1.5} />; // fallback
  };

  const getLandmarkIcon = (type: string) => {
    switch (type) {
      case 'Airport': return <Plane size={18} strokeWidth={2} />;
      case 'Train': return <Train size={18} strokeWidth={2} />;
      case 'Shopping': return <ShoppingBag size={18} strokeWidth={2} />;
      case 'Hospital': return <Hospital size={18} strokeWidth={2} />;
      case 'Attraction': return <Mountain size={18} strokeWidth={2} />;
      default: return <MapPin size={18} strokeWidth={2} />;
    }
  };

  // Find lowest price
  const startingPrice = stay.rooms?.length > 0 
    ? Math.min(...stay.rooms.map(r => r.priceUSDC))
    : stay.priceUSDC;

  const firstLandmark = stay.address?.landmarks?.[0];

  return (
    <div className="min-h-screen bg-[#F3EDE0] text-[#3D4331] font-sans pb-24 selection:bg-[#96A476] selection:text-[#F3EDE0] relative overflow-hidden">
      
      {/* Top Background Blob */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#EBE1D0] rounded-full blur-[100px] opacity-70 pointer-events-none -translate-y-1/3 translate-x-1/4"></div>

      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-10 relative z-10">
        
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-[#3D4331] text-[#F3EDE0] flex items-center justify-center hover:bg-[#525942] transition-colors">
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div className="text-[13px] font-bold tracking-wide text-[#3D4331] flex items-center gap-1.5">
            <span style={{ fontFamily: "'Caveat', cursive" }} className="text-xl capitalize">Live</span>
            <span className="uppercase">STAYS</span> 
            <span className="text-[#3D4331]/30 mx-0.5">/</span> 
            <span className="text-[#3D4331]/70 font-semibold">Stay Detail</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <div className="inline-block px-3 py-1.5 bg-[#96A476] text-[#3D4331] text-[9px] font-bold tracking-widest uppercase rounded-full mb-5">
              FEATURED STAY
            </div>
            {/* Title using a generic serif that looks like Playfair or PT Serif */}
            <h1 className="text-4xl md:text-[44px] font-bold text-[#3D4331] mb-4 font-serif" style={{ letterSpacing: '-0.5px' }}>
              {stay.title}
            </h1>
            <div className="flex flex-wrap items-center text-[#585E4B] text-[15px] font-semibold">
              <MapPin size={16} className="mr-2" strokeWidth={2.5} />
              {stay.location}
              {firstLandmark && (
                <>
                  <span className="mx-2 text-[#3D4331]/30">•</span>
                  {firstLandmark.distance} from {firstLandmark.name}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3 min-w-fit">
            <div className="text-left md:text-right">
              <div className="text-sm font-bold text-[#585E4B] mb-0.5">Starting at</div>
              <div className="text-[40px] font-black text-[#3D4331] leading-none mb-2">
                ${startingPrice}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#585E4B] font-semibold">
                per night • taxes extra
              </div>
            </div>
              <Link href={`/stay/${stay.stayId}/apply?guests=${searchParams.get("guests") || 1}`} className="bg-[#3D4331] text-[#F3EDE0] px-8 py-3.5 rounded-full font-bold text-sm tracking-widest hover:bg-[#525942] transition-colors flex items-center gap-2 mt-2 shadow-lg shadow-[#3D4331]/10">
                Book Stay <span className="text-lg leading-none">+</span>
              </Link>
          </div>
        </div>

        {/* Gallery Section */}
        <div className="flex flex-col md:flex-row gap-5 h-[400px] mb-16">
          {/* Main Image */}
          <div className="relative w-full md:w-[65%] h-full rounded-[24px] overflow-hidden bg-[#D5CDBC]">
            {images[imageIndex] && (
              <Image
                src={images[imageIndex]}
                alt={stay.title}
                fill
                className="object-cover"
              />
            )}
            {images.length > 1 && (
              <div className="absolute bottom-6 right-6 flex gap-2">
                <button onClick={prevImage} className="w-10 h-10 rounded-full bg-[#3D4331]/90 text-[#F3EDE0] flex items-center justify-center hover:bg-[#3D4331] transition backdrop-blur-sm">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={nextImage} className="w-10 h-10 rounded-full bg-[#F3EDE0]/90 text-[#3D4331] flex items-center justify-center hover:bg-white transition backdrop-blur-sm shadow-sm">
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
          
          {/* Side Images */}
          <div className="hidden md:flex flex-col gap-5 w-[35%] h-full">
            <div className="relative w-full h-1/2 rounded-[24px] overflow-hidden bg-[#D5CDBC]">
              {images[1] && <Image src={images[1]} alt="Gallery 2" fill className="object-cover" />}
            </div>
            <div className="relative w-full h-1/2 rounded-[24px] overflow-hidden bg-[#D5CDBC]">
              {images[2] && <Image src={images[2]} alt="Gallery 3" fill className="object-cover" />}
              {images.length > 3 && (
                <div className="absolute bottom-5 right-5 bg-[#3D4331]/90 backdrop-blur-sm text-[#F3EDE0] px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase">
                  +{images.length - 3} PHOTOS
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-x-16 gap-y-16">
          
          {/* LEFT COLUMN: Rooms, Amenities, Notes */}
          <div className="space-y-14">
            
            {/* Types of Room */}
            <section>
              <div className="w-8 h-[2px] bg-[#96A476] mb-5"></div>
              <h2 className="text-[28px] font-serif font-bold mb-8 text-[#3D4331]">Types of Room</h2>
              
              <div className="space-y-5">
                {stay.rooms?.map((room, idx) => (
                  <div key={idx} className="bg-[#EBE1D0] rounded-[24px] p-5 flex flex-col sm:flex-row gap-6 items-stretch">
                    {/* Room Thumbnail */}
                    <div className="w-full sm:w-32 h-40 sm:h-auto rounded-[16px] bg-[#D5CDBC] flex-shrink-0 relative overflow-hidden">
                      {room.images?.[0] && <Image src={room.images[0]} alt={room.name} fill className="object-cover" />}
                    </div>
                    
                    {/* Room Details */}
                    <div className="flex-grow flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-[22px] font-serif font-bold text-[#3D4331] mb-1 leading-tight">{room.name}</h3>
                          <div className="text-[13px] font-medium text-[#585E4B] flex flex-wrap gap-1.5 items-center">
                            <span>{room.capacity} Adults</span>
                            {room.beds && (
                              <>
                                <span className="text-[#3D4331]/20">•</span>
                                <span>{room.beds}</span>
                              </>
                            )}
                            {room.area && (
                              <>
                                <span className="text-[#3D4331]/20">•</span>
                                <span>{room.area}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-[26px] font-black text-[#3D4331] leading-none mb-1">${room.priceUSDC}</div>
                          <div className="text-[10px] text-[#585E4B] font-semibold">per night</div>
                          {room.roomsLeft !== undefined && room.roomsLeft > 0 && (
                            <div className="text-[10px] text-[#96A476] font-semibold mt-1">
                              {room.roomsLeft} rooms left
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-6">
                        {room.amenities?.map((am, i) => (
                          <span key={i} className="px-3 py-1.5 bg-[#D5CDBC]/30 rounded-full text-[10px] font-bold text-[#3D4331] tracking-wide">
                            {am}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {(!stay.rooms || stay.rooms.length === 0) && (
                  <div className="text-[#585E4B] text-sm italic">No rooms listed for this stay.</div>
                )}
              </div>
            </section>

            {/* Amenities */}
            <section>
              <div className="w-8 h-[2px] bg-[#96A476] mb-5"></div>
              <h2 className="text-[28px] font-serif font-bold mb-8 text-[#3D4331]">Amenities</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-10 gap-x-6">
                {stay.amenities?.map((am, idx) => (
                  <div key={idx} className="flex flex-col gap-3">
                    <div className="text-[#3D4331]">
                      {getAmenityIcon(am)}
                    </div>
                    <div className="text-[13px] font-bold text-[#3D4331] leading-snug pr-2">{am}</div>
                  </div>
                ))}
                {(!stay.amenities || stay.amenities.length === 0) && (
                  <div className="text-[#585E4B] text-sm italic col-span-2">No amenities listed.</div>
                )}
              </div>
            </section>

            {/* Extra Notes */}
            <section>
              <div className="w-8 h-[2px] bg-[#96A476] mb-5"></div>
              <h2 className="text-[28px] font-serif font-bold mb-8 text-[#3D4331]">Extra Notes</h2>
              
              <div className="bg-[#EBE1D0] rounded-[24px] p-8 border border-[#EBE1D0] border-opacity-50 border-dashed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
                  {stay.rules?.map((rule, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#96A476] mt-2 flex-shrink-0"></div>
                      <span className="text-[13px] font-semibold text-[#585E4B] leading-relaxed">{rule}</span>
                    </div>
                  ))}
                  {(!stay.rules || stay.rules.length === 0) && (
                    <div className="text-[#585E4B] text-sm italic">No extra notes provided.</div>
                  )}
                </div>
              </div>
            </section>

          </div>
          
          {/* RIGHT COLUMN: Location, Landmarks */}
          <div className="space-y-14">
            
            {/* Location */}
            <section>
              <div className="w-8 h-[2px] bg-[#96A476] mb-5"></div>
              <h2 className="text-[28px] font-serif font-bold mb-6 text-[#3D4331]">Location</h2>
              
              <div className="bg-[#EBE1D0] rounded-[24px] mb-6 h-56 relative overflow-hidden flex items-center justify-center">
                {(() => {
                  let embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(stay.address?.fullAddress || stay.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
                  
                  if (stay.address?.mapUrl) {
                    if (stay.address.mapUrl.includes('<iframe') && stay.address.mapUrl.includes('src="')) {
                      // Extract src from iframe string
                      const match = stay.address.mapUrl.match(/src="([^"]+)"/);
                      if (match && match[1]) {
                        embedUrl = match[1];
                      }
                    } else if (stay.address.mapUrl.includes('embed')) {
                      embedUrl = stay.address.mapUrl;
                    }
                  }

                  return (
                    <iframe
                      src={embedUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={true}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="absolute inset-0"
                    ></iframe>
                  );
                })()}
              </div>
              
              <p className="text-[13px] font-medium text-[#585E4B] mb-6 leading-relaxed">
                {stay.address?.fullAddress || stay.location}
              </p>
              
              <a 
                href={stay.address?.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(stay.address?.fullAddress || stay.location)}`}
                target="_blank"
                rel="noopener noreferrer" 
                className="inline-flex items-center justify-center gap-2 bg-[#3D4331] text-[#F3EDE0] px-6 py-2.5 rounded-full text-[11px] font-bold tracking-widest hover:bg-[#525942] transition w-fit"
              >
                Get Directions <ArrowRight size={14} />
              </a>
            </section>

            {/* Nearby Landmarks */}
            {stay.address?.landmarks && stay.address.landmarks.length > 0 && (
              <section>
                <div className="w-8 h-[2px] bg-[#96A476] mb-5"></div>
                <h2 className="text-[28px] font-serif font-bold mb-6 text-[#3D4331]">Nearby Landmarks</h2>
                
                <div className="space-y-0">
                  {stay.address.landmarks.map((landmark, idx) => (
                    <div key={idx} className="flex justify-between items-center py-4 border-b border-[#3D4331]/10 last:border-0">
                      <div className="flex items-center gap-3 text-[#3D4331]">
                        {getLandmarkIcon(landmark.type)}
                        <span className="text-[13px] font-bold text-[#3D4331]">{landmark.name}</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#96A476]">{landmark.distance}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            
          </div>
        </div>

      </div>
    </div>
  );
}
