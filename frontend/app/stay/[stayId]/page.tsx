import { notFound } from 'next/navigation';
import { db } from '@/lib/database';
import StayDetailsClient from './StayDetailsClient';
import { Suspense } from 'react';

export default async function StayDetailsPage({
  params,
}: {
  params: Promise<{ stayId: string }>;
}) {
  const { stayId } = await params;

  const stay = await db.stay.findUnique({
    where: { stayId },
  });

  if (!stay || !stay.isPublished) {
    notFound();
  }

  // Convert to plain object for client - including rooms
  const stayData = {
    id: stay.id,
    stayId: stay.stayId,
    title: stay.title,
    slug: stay.slug,
    location: stay.location,
    description: stay.description || '',
    startDate: stay.startDate.toISOString(),
    endDate: stay.endDate.toISOString(),
    duration: stay.duration,
    priceUSDC: stay.priceUSDC,
    priceUSDT: stay.priceUSDT,
    slotsTotal: stay.slotsTotal,
    slotsAvailable: stay.slotsAvailable,
    allowWaitlist: stay.allowWaitlist,
    images: stay.images || [],
    amenities: stay.amenities || [],
    highlights: stay.highlights || [],
    rules: stay.rules || [], // ✅ Added
    address: stay.address || null, // ✅ Added
    rooms: stay.rooms || [], // ✅ Rooms are already included
  };

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7eedb] flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin" /></div>}>
      <StayDetailsClient stay={stayData} />
    </Suspense>
  );
}