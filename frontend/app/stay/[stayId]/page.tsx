import { notFound } from 'next/navigation';
import { db } from '@/lib/database';
import StayDetailsClient from './StayDetailsClient';

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
    rooms: stay.rooms || [], // ✅ Rooms are already included
  };

  return <StayDetailsClient stay={stayData} />;
}