// app/villas/page.tsx
// ✅ FIXED: Prevents caching issues between localhost and production

import { db } from "@/lib/database";
import Image from "next/image";
import Link from "next/link";

// ============================================================================
// ✅ CRITICAL FIX: Force Dynamic Rendering
// ============================================================================
// This prevents Next.js from caching the page at build time
// Choose ONE of these options:

// Option 1: Always fetch fresh data (recommended for admin-facing pages)
export const dynamic = 'force-dynamic';

// Option 2: Revalidate every 60 seconds (better for public pages)
// export const revalidate = 60;

// Option 3: Use 'auto' but add cache: 'no-store' to the query
// export const dynamic = 'auto';
// ============================================================================

async function getStays() {
  const stays = await db.stay.findMany({
    where: { isPublished: true },
    orderBy: { startDate: "asc" },
  });
  
  console.log(`[Villas Page] Fetched ${stays.length} published stays`);
  return stays;
}

export default async function VillasPage() {
  const stays = await getStays();

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-24">
      <h1 className="text-5xl font-bold text-[#172a46] mb-12">
        Upcoming Stays
      </h1>
      
      {stays.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No upcoming stays available at the moment.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {stays.map((stay) => (
            <Link
              key={stay.id}
              href={`/stay/${stay.stayId}`}
              className="bg-white p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow grid md:grid-cols-2 gap-4"
            >
              <div className="relative w-full h-56 rounded-xl overflow-hidden grid-cols-1">
                <Image
                  src={stay.images?.[0] || "/logo-no-bg.png"}
                  alt={stay.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="grid-cols-1">
                <h3 className="text-2xl font-bold text-[#172a46]">
                  {stay.title}
                </h3>
                <p className="text-gray-600 mt-2">{stay.location}</p>
                <p className="text-gray-800 font-semibold mt-4">
                  {new Date(stay.startDate).toLocaleDateString()} -{" "}
                  {new Date(stay.endDate).toLocaleDateString()}
                </p>
                <span className="mt-4 inline-block bg-[#172a46] text-white text-sm font-semibold py-2 px-5 rounded-full">
                  View Details
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}