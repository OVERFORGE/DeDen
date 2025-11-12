"use client";

import { useState } from 'react';
import { Star, Check, Calendar, Users, DollarSign, MapPin } from 'lucide-react';
import StayApplyButton from '@/components/StayApplyButton';

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
  amenities: string[];
  highlights: string[];
  rooms: any[];
};

export default function StayDetailsClient({ stay }: { stay: StayData }) {
  const [selectedImage, setSelectedImage] = useState(0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculatedDuration = stay.duration || Math.ceil((new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-[#172a46] text-[#F5F5F3]">
      {/* Hero Section with Split Layout */}
      <section className="relative bg-[#F5F5F3] pt-8 pb-12">
        <div className="max-w-screen-xl mx-auto px-6">
          {/* Breadcrumb */}
          <div className="text-gray-600 text-sm mb-8">
            <span className="hover:text-[#172a46] cursor-pointer">Home</span>
            <span className="mx-2">/</span>
            <span className="hover:text-[#172a46] cursor-pointer">Stays</span>
            <span className="mx-2">/</span>
            <span className="text-[#172a46] font-semibold">{stay.title}</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* LEFT: Image Gallery */}
            <div className="space-y-4">
              {/* Main Large Image */}
              {stay.images && stay.images.length > 0 ? (
                <>
                  <div className="w-full h-[500px] rounded-2xl overflow-hidden shadow-xl border-4 border-white">
                    <img 
                      src={stay.images[selectedImage]} 
                      alt={stay.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  
                  {/* Thumbnail Grid Below */}
                  <div className="grid grid-cols-4 gap-3">
                    {stay.images.slice(0, 4).map((img, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={`h-28 rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-105 shadow-md border-2 ${
                          selectedImage === idx ? 'border-[#172a46] ring-2 ring-[#172a46]' : 'border-white'
                        }`}
                      >
                        <img 
                          src={img} 
                          alt={`View ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="w-full h-[500px] rounded-2xl bg-gray-200 flex items-center justify-center text-4xl text-gray-400">
                  📸 No images yet
                </div>
              )}
              
              {/* Event Title Below Images */}
              <div className="pt-4">
                <h1 
                  className="text-5xl md:text-6xl font-bold text-[#172a46] mb-4"
                  style={{ 
                    fontFamily: "'New Rocker', cursive",
                    letterSpacing: '-0.05em'
                  }}
                >
                  {stay.title}
                </h1>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={20} className="text-[#172a46]" />
                  <span className="text-lg">{stay.location}</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Overview Card & Apply Button */}
            <div className="lg:sticky lg:top-8 space-y-6">
              {/* Overview Card */}
              <div className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-[#172a46]">
                <h2 className="text-3xl font-bold text-[#172a46] mb-6">Overview</h2>
                
                <div className="space-y-6">
                  {/* Price */}
                  <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#172a46] rounded-xl flex items-center justify-center">
                        <DollarSign className="text-white" size={24} />
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Price</div>
                        <div className="text-2xl font-bold text-[#172a46]">${stay.priceUSDC} USDC</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Duration */}
                  <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#172a46] rounded-xl flex items-center justify-center">
                        <Calendar className="text-white" size={24} />
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Duration</div>
                        <div className="text-xl font-bold text-[#172a46]">{calculatedDuration} Days</div>
                        <div className="text-sm text-gray-600">{formatDate(stay.startDate)} - {formatDate(stay.endDate)}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Availability */}
                  <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#172a46] rounded-xl flex items-center justify-center">
                        <Users className="text-white" size={24} />
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Availability</div>
                        <div className="text-xl font-bold text-[#172a46]">
                          {stay.slotsAvailable} of {stay.slotsTotal} slots
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Rating */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#172a46] rounded-xl flex items-center justify-center">
                        <Star className="text-white" fill="white" size={24} />
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Rating</div>
                        <div className="text-xl font-bold text-[#172a46]">4.9 / 5.0</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Apply Button Card */}
              <div className="bg-gradient-to-br from-[#172a46] to-[#2a4a6a] rounded-3xl shadow-2xl p-6 text-center border-4 border-[#172a46]">
                <StayApplyButton 
                  stayId={stay.stayId} 
                  stayTitle={stay.title}
                  slotsAvailable={stay.slotsAvailable}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="max-w-screen-xl mx-auto px-6 py-20 bg-[#F5F5F3]">
        <h2 
          className="text-4xl md:text-5xl font-bold text-[#172a46] mb-8"
          style={{ 
            fontFamily: "'New Rocker', cursive",
            letterSpacing: '-0.05em'
          }}
        >
          About This Stay
        </h2>
        <p className="text-lg text-[#172a46] leading-relaxed whitespace-pre-line max-w-4xl opacity-90">
          {stay.description}
        </p>
      </section>

      {/* Amenities & Highlights Grid */}
      <section className="bg-[#172a46] py-20 relative">
        <div className="max-w-screen-xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Amenities */}
            {stay.amenities && stay.amenities.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border-2 border-white/10 hover:border-white/20 transition-all">
                <h3 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    ✓
                  </div>
                  What's Included
                </h3>
                <div className="space-y-4">
                  {stay.amenities.map((amenity, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-white bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-all">
                      <div className="w-6 h-6 rounded-full bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 mt-1">
                        <Check size={16} className="text-[#172a46]" />
                      </div>
                      <span className="text-lg text-gray-100">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Highlights */}
            {stay.highlights && stay.highlights.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border-2 border-white/10 hover:border-white/20 transition-all">
                <h3 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    🎯
                  </div>
                  What to Expect
                </h3>
                <div className="space-y-4">
                  {stay.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-white bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-all">
                      <div className="text-2xl flex-shrink-0">✨</div>
                      <span className="text-lg text-gray-100">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Room Options */}
      {stay.rooms && stay.rooms.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-6 py-20 bg-[#F5F5F3]">
          <h2 
            className="text-4xl md:text-5xl font-bold text-[#172a46] mb-12 text-center"
            style={{ 
              fontFamily: "'New Rocker', cursive",
              letterSpacing: '-0.05em'
            }}
          >
            Room Options
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {stay.rooms.map((room) => (
              <div key={room.id} className="bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] border-4 border-[#172a46]/10">
                {room.images && room.images.length > 0 ? (
                  <div className="h-64 relative overflow-hidden">
                    <img 
                      src={room.images[0]} 
                      alt={room.name}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-4 right-4 bg-[#172a46] text-white px-4 py-2 rounded-full font-bold text-lg">
                      ${room.price}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-6xl">
                    🛏️
                  </div>
                )}
                <div className="p-8">
                  <h4 className="text-2xl font-bold text-[#172a46] mb-3">
                    {room.name}
                  </h4>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {room.description}
                  </p>
                  <div className="flex items-center gap-2 text-[#172a46] mb-4 bg-[#172a46]/5 p-3 rounded-xl">
                    <Users size={18} />
                    <span className="font-semibold">Capacity: {room.capacity} {room.capacity === 1 ? 'person' : 'people'}</span>
                  </div>
                  {room.amenities && room.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {room.amenities.slice(0, 4).map((amenity: string, idx: number) => (
                        <span 
                          key={idx}
                          className="px-4 py-2 bg-[#172a46]/10 text-[#172a46] text-sm rounded-full font-semibold border-2 border-[#172a46]/20"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 pt-4 border-t-2 border-gray-200">
                    <span className="text-4xl font-bold text-[#172a46]">${room.price}</span>
                    <span className="text-lg text-gray-500">USDC</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="bg-[#172a46] py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 
            className="text-4xl md:text-5xl font-bold text-white mb-12 text-center"
            style={{ 
              fontFamily: "'New Rocker', cursive",
              letterSpacing: '-0.05em'
            }}
          >
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-sm border-2 border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
              <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                <span className="text-2xl">❓</span>
                What's the application process?
              </h4>
              <p className="text-gray-200 leading-relaxed">
                Submit your application → Wait for approval (24-48h) → Pay with crypto → You're in!
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm border-2 border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
              <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                <span className="text-2xl">💳</span>
                What payment methods do you accept?
              </h4>
              <p className="text-gray-200 leading-relaxed">
                We accept USDC and USDT on BSC network. You'll need a crypto wallet like MetaMask.
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm border-2 border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
              <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                <span className="text-2xl">🔄</span>
                What's your cancellation policy?
              </h4>
              <p className="text-gray-200 leading-relaxed">
                Full refund if cancelled 14+ days before. 50% refund if 7-14 days before. No refund within 7 days.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}