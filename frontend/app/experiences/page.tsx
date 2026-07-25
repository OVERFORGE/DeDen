// app/experiences/page.tsx
import { db } from "@/lib/database";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Calendar, Star } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getPastExperiences() {
  const stays = await db.stay.findMany({
    where: { status: "DONE" },
    orderBy: { endDate: "desc" },
  });
  return stays;
}

export default async function ExperiencesPage() {
  const stays = await getPastExperiences();

  return (
    <div className="min-h-screen bg-[#f7eedb] py-16 px-6 sm:px-10 font-inter text-[#2c331f]">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="relative mb-20 text-center">
          <h1 className="leading-[0.8] flex flex-col items-center justify-center mb-6">
            <span className="text-7xl md:text-8xl text-[#9db47d]" style={{ fontFamily: "'Caveat', cursive" }}>
              Our Past
            </span>
            <span className="font-display font-black text-6xl md:text-7xl tracking-wide mt-[-5px]">
              EXPERIENCES
            </span>
          </h1>
          <p className="mt-6 font-semibold max-w-2xl mx-auto tracking-wide leading-relaxed opacity-80 uppercase text-sm">
            A look back at the incredible moments, connections, and memories created during our previous dens.
          </p>
        </div>

        {/* Experiences List */}
        <div className="flex flex-col gap-24 pb-20">
          {stays.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg font-bold opacity-70">More experiences coming soon.</p>
            </div>
          ) : (
            stays.map((stay: any) => (
              <div key={stay.id} className="flex flex-col gap-8 bg-white p-8 md:p-12 rounded-3xl border-2 border-[#2c331f] shadow-[8px_8px_0px_0px_#2c331f]">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-[#2c331f] pb-8">
                  <div>
                    <h2 className="text-4xl md:text-5xl font-black font-display tracking-tight mb-2 uppercase">{stay.title}</h2>
                    <div className="flex flex-wrap gap-4 text-xs font-bold uppercase tracking-widest text-[#5a6b3a]">
                      <span className="flex items-center gap-1"><MapPin size={14} /> {stay.location}</span>
                      <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(stay.startDate).toLocaleDateString()} - {new Date(stay.endDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Gallery */}
                {stay.galleryImages && stay.galleryImages.length > 0 && (
                  <div className="py-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-6 border-l-4 border-[#9db47d] pl-3">Event Gallery</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {stay.galleryImages.map((img: string, i: number) => (
                        <div key={i} className="relative aspect-video rounded-xl overflow-hidden border-2 border-[#2c331f]">
                          <Image src={img} alt={`${stay.title} gallery image ${i+1}`} fill className="object-cover hover:scale-105 transition-transform duration-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Testimonials */}
                {stay.testimonials && stay.testimonials.length > 0 && (
                  <div className="py-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-6 border-l-4 border-[#e8c37b] pl-3">What People Said</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {stay.testimonials.map((test: any, i: number) => (
                        <div key={i} className="bg-[#f7eedb] p-6 rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
                          <div className="flex text-[#e8c37b] mb-3">
                            <Star size={16} fill="currentColor" />
                            <Star size={16} fill="currentColor" />
                            <Star size={16} fill="currentColor" />
                            <Star size={16} fill="currentColor" />
                            <Star size={16} fill="currentColor" />
                          </div>
                          <p className="italic font-medium mb-6 text-sm leading-relaxed">"{test.text}"</p>
                          <div className="flex items-center gap-3">
                            {test.avatarUrl ? (
                              <Image src={test.avatarUrl} alt={test.name} width={40} height={40} className="rounded-full border-2 border-[#2c331f]" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#9db47d] border-2 border-[#2c331f] flex items-center justify-center font-bold">{test.name.charAt(0)}</div>
                            )}
                            <span className="font-bold uppercase tracking-wider text-xs">{test.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
