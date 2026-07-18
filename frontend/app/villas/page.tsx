// app/villas/page.tsx
// ✅ FIXED: Prevents caching issues between localhost and production

import { db } from "@/lib/database";
import VillaStayCard from "@/components/VillaStayCard";

// ============================================================================
// ✅ CRITICAL FIX: Force Dynamic Rendering
// ============================================================================
export const dynamic = 'force-dynamic';

async function getStays() {
  const stays = await db.stay.findMany({
    where: { isPublished: true },
    orderBy: { startDate: "asc" },
  });
  return stays;
}

export default async function VillasPage() {
  const stays = await getStays();

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

        {/* Stays List */}
        <div className="flex flex-col gap-24 pb-20">
          {stays.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#43392e] text-lg font-bold">No upcoming stays available at the moment.</p>
            </div>
          ) : (
            stays.map((stay) => (
              <VillaStayCard key={stay.id} stay={stay} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}