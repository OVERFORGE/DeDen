// Script: update-existing-data.ts
import { db } from '@/lib/database';

async function updateExistingData() {
  console.log('🔄 Updating existing stays...');
  
  // 1. Add duration to all stays
  const stays = await db.stay.findMany();
  for (const stay of stays) {
    const nights = Math.ceil(
      (new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) 
      / (1000 * 60 * 60 * 24)
    );
    
    await db.stay.update({
      where: { id: stay.id },
      data: { duration: nights }
    });
    
    console.log(`✅ ${stay.title}: ${nights} nights`);
  }

  console.log('\n🔄 Updating existing bookings...');
  
  // 2. Add numberOfNights to bookings
  const bookings = await db.booking.findMany({
    include: { stay: true }
  });
  
  for (const booking of bookings) {
    const nights = booking.stay.duration || 3; // fallback
    
    // If selectedRoomPriceUSDC exists, calculate per-night
    const perNightUSDC = booking.selectedRoomPriceUSDC 
      ? booking.selectedRoomPriceUSDC / nights 
      : null;
    
    const perNightUSDT = booking.selectedRoomPriceUSDT 
      ? booking.selectedRoomPriceUSDT / nights 
      : null;
    
    await db.booking.update({
      where: { id: booking.id },
      data: {
        numberOfNights: nights,
        pricePerNightUSDC: perNightUSDC,
        pricePerNightUSDT: perNightUSDT,
      }
    });
    
    console.log(`✅ Booking ${booking.bookingId}: ${nights} nights`);
  }
  
  console.log('\n✅ Migration complete!');
}

// Run it
updateExistingData()
  .catch(console.error)
  .finally(() => process.exit());