// scripts/seed-stay.ts
// Run this with: npx tsx scripts/seed-stay.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create the IBW 2025 stay
  const stay = await prisma.stay.upsert({
    where: { stayId: 'IBW-2025' },
    update: {
      slug: 'ibw-2025',
      title: 'India Blockchain Week 2025 Den',
      description: 'Join us for an exclusive coliving experience during India Blockchain Week 2025 in Goa. Network with builders, founders, and web3 enthusiasts. Meet fellow builders, attend exclusive workshops, and enjoy beach vibes while connecting with the web3 community.',
      shortDescription: 'Exclusive coliving experience during IBW 2025 in Goa',
      location: 'Goa, India',
      venue: 'Beachfront Villa, North Goa',
      allowWaitlist: true,
      isPublished: true,
      isFeatured: true,
      startDate: new Date('2025-12-01'),
      endDate: new Date('2025-12-15'),
      duration: 14,
      slotsTotal: 20,
      slotsAvailable: 20,
      guestCapacity: 20,
      priceUSDC: 300.0,
      priceUSDT: 300.0,
      amenities: ['WiFi', 'Workspace', 'Kitchen', 'Pool', 'Beach Access'],
      highlights: ['Meet 100+ builders', 'Exclusive workshops', 'Networking dinners', 'Beach parties'],
      rules: ['No smoking indoors', 'Quiet hours 10pm-8am', 'Respect shared spaces'],
      tags: ['blockchain', 'web3', 'india', 'coworking', 'networking'],
    },
    create: {
      stayId: 'IBW-2025',
      slug: 'ibw-2025',
      title: 'India Blockchain Week 2025 Den',
      description: 'Join us for an exclusive coliving experience during India Blockchain Week 2025 in Goa. Network with builders, founders, and web3 enthusiasts. Meet fellow builders, attend exclusive workshops, and enjoy beach vibes while connecting with the web3 community.',
      shortDescription: 'Exclusive coliving experience during IBW 2025 in Goa',
      location: 'Goa, India',
      venue: 'Beachfront Villa, North Goa',
      allowWaitlist: true,
      isPublished: true,
      isFeatured: true,
      autoConfirm: false,
      startDate: new Date('2025-12-01'),
      endDate: new Date('2025-12-15'),
      duration: 14,
      slotsTotal: 20,
      slotsAvailable: 20,
      guestCapacity: 20,
      priceUSDC: 300.0,
      priceUSDT: 300.0,
      currency: 'USD',
      checkInTime: '2:00 PM',
      checkOutTime: '11:00 AM',
      amenities: ['WiFi', 'Workspace', 'Kitchen', 'Pool', 'Beach Access'],
      highlights: ['Meet 100+ builders', 'Exclusive workshops', 'Networking dinners', 'Beach parties'],
      rules: ['No smoking indoors', 'Quiet hours 10pm-8am', 'Respect shared spaces'],
      tags: ['blockchain', 'web3', 'india', 'coworking', 'networking'],
      metaTitle: 'IBW 2025 Den - Coliving in Goa',
      metaDescription: 'Join us for India Blockchain Week 2025. Network with builders, attend workshops, and enjoy Goa.',
    },
  });

  console.log('✅ Created stay:', stay.stayId, '-', stay.title);

  // Create ETHDenver 2026 stay
  const stay2 = await prisma.stay.upsert({
    where: { stayId: 'ETH-DENVER-2026' },
    update: {
      slug: 'eth-denver-2026',
      title: 'ETHDenver 2026 Hacker House',
      description: 'Coliving during ETHDenver 2026. Build, hack, and connect with the Ethereum community.',
      shortDescription: 'Hacker house during ETHDenver 2026',
      location: 'Denver, Colorado',
      venue: 'Downtown Denver House',
      allowWaitlist: true,
      isPublished: false,
      isFeatured: false,
      startDate: new Date('2026-02-20'),
      endDate: new Date('2026-03-05'),
      duration: 13,
      slotsTotal: 15,
      slotsAvailable: 15,
      guestCapacity: 15,
      priceUSDC: 250.0,
      priceUSDT: 250.0,
    },
    create: {
      stayId: 'ETH-DENVER-2026',
      slug: 'eth-denver-2026',
      title: 'ETHDenver 2026 Hacker House',
      description: 'Coliving during ETHDenver 2026. Build, hack, and connect with the Ethereum community.',
      shortDescription: 'Hacker house during ETHDenver 2026',
      location: 'Denver, Colorado',
      venue: 'Downtown Denver House',
      allowWaitlist: true,
      isPublished: false,
      isFeatured: false,
      autoConfirm: false,
      startDate: new Date('2026-02-20'),
      endDate: new Date('2026-03-05'),
      duration: 13,
      slotsTotal: 15,
      slotsAvailable: 15,
      guestCapacity: 15,
      priceUSDC: 250.0,
      priceUSDT: 250.0,
      currency: 'USD',
      checkInTime: '3:00 PM',
      checkOutTime: '12:00 PM',
      amenities: ['WiFi', 'Workspace', 'Parking', 'Kitchen'],
      highlights: ['ETHDenver access', 'Hacker workspace', 'Community dinners'],
      rules: ['No pets', 'Quiet hours 11pm-7am'],
      tags: ['ethereum', 'ethdenver', 'hacking', 'denver'],
      metaTitle: 'ETHDenver 2026 Hacker House',
      metaDescription: 'Stay and hack during ETHDenver 2026 in our community house.',
    },
  });

  console.log('✅ Created stay:', stay2.stayId, '-', stay2.title);

  console.log('✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });