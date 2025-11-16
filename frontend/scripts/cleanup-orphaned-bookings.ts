

// File: scripts/cleanup-orphaned-bookings.ts
// Script to identify and fix orphaned bookings (bookings with non-existent users)

import { db } from '@/lib/database';

async function cleanupOrphanedBookings() {
  console.log('🔍 Starting orphaned bookings cleanup...\n');

  try {
    // 1. Fetch all bookings
    const allBookings = await db.booking.findMany({
      select: {
        id: true,
        bookingId: true,
        userId: true,
        guestName: true,
        guestEmail: true,
        status: true,
        createdAt: true,
      },
    });

    console.log(`📊 Total bookings: ${allBookings.length}`);

    // 2. Fetch all user IDs
    const allUsers = await db.user.findMany({
      select: {
        id: true,
      },
    });

    const validUserIds = new Set(allUsers.map(u => u.id));
    console.log(`👥 Total users: ${allUsers.length}\n`);

    // 3. Find orphaned bookings
    const orphanedBookings = allBookings.filter(
      booking => !validUserIds.has(booking.userId)
    );

    if (orphanedBookings.length === 0) {
      console.log('✅ No orphaned bookings found! Database is clean.');
      return;
    }

    console.log(`⚠️  Found ${orphanedBookings.length} orphaned bookings:\n`);

    // 4. Display orphaned bookings
    orphanedBookings.forEach((booking, index) => {
      console.log(`${index + 1}. Booking ID: ${booking.bookingId}`);
      console.log(`   User ID: ${booking.userId} (MISSING)`);
      console.log(`   Guest: ${booking.guestName || 'N/A'}`);
      console.log(`   Email: ${booking.guestEmail || 'N/A'}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Created: ${booking.createdAt.toLocaleDateString()}`);
      console.log('');
    });

    // 5. Options to fix
    console.log('\n📋 Recommended Actions:\n');
    console.log('Option 1: Create placeholder users for orphaned bookings');
    console.log('Option 2: Delete orphaned bookings (if they are test data)');
    console.log('Option 3: Update schema to make user relation optional');
    console.log('\nTo execute a fix, uncomment the relevant section below and run again.\n');

    // ===============================================
    // OPTION 1: Create placeholder users (COMMENTED OUT - Uncomment to use)
    // ===============================================
    /*
    console.log('Creating placeholder users...');
    for (const booking of orphanedBookings) {
      await db.user.create({
        data: {
          id: booking.userId,
          email: booking.guestEmail || `placeholder-${booking.userId}@example.com`,
          displayName: booking.guestName || 'Deleted User',
          userRole: 'GUEST',
        },
      });
      console.log(`✓ Created placeholder user for ${booking.bookingId}`);
    }
    console.log('✅ Placeholder users created successfully!');
    */

    // ===============================================
    // OPTION 2: Delete orphaned bookings (COMMENTED OUT - Uncomment to use)
    // ===============================================
    /*
    console.log('Deleting orphaned bookings...');
    for (const booking of orphanedBookings) {
      await db.booking.delete({
        where: { id: booking.id },
      });
      console.log(`✓ Deleted booking ${booking.bookingId}`);
    }
    console.log('✅ Orphaned bookings deleted successfully!');
    */

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run the script
cleanupOrphanedBookings()
  .then(() => {
    console.log('\n✅ Cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  });