// deleteUser.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- CONFIGURATION ---
// Set the email of the user you want to permanently delete
const USER_EMAIL_TO_DELETE = 'annapancholi.457@gmail.com';
// ---------------------

async function deleteUserAndAllData(email: string) {
  // ✅ FIX 1: This check now correctly looks for the placeholder email
  if (!email || email === 'user-to-delete@example.com') {
    console.error(
      '❌ Please set a valid email in the USER_EMAIL_TO_DELETE variable.',
    );
    return;
  }

  console.log(`Attempting to delete all data for user: ${email}...`);

  try {
    // 1. Find the user to get their ID
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      console.warn(`User with email ${email} not found. No action taken.`);
      return;
    }

    const userId = user.id;
    console.log(`Found user with ID: ${userId}. Proceeding with deletion...`);

    // 2. Use a transaction to delete all related data AND the user
    // This ensures that if any step fails, the entire operation is rolled back.
    const [
      deletedActivities,
      deletedRefunds,
      deletedReviews,
      deletedWaitlist,
      deletedBookings,
      deletedAccounts,
      deletedSessions,
      deletedTokens,
      deletedNotifications,
      deletedUser, // This will be the deleted User object
    ] = await prisma.$transaction([
      // --- App-specific models ---
      // These models relate to the User via `userId`
      prisma.activityLog.deleteMany({ where: { userId: userId } }),
      prisma.refund.deleteMany({ where: { userId: userId } }),
      prisma.review.deleteMany({ where: { userId: userId } }),
      prisma.waitlistEntry.deleteMany({ where: { userId: userId } }),
      prisma.booking.deleteMany({ where: { userId: userId } }),
      prisma.notification.deleteMany({ where: { recipientId: userId } }),

      // --- NextAuth adapter models ---
      prisma.account.deleteMany({ where: { userId: userId } }),
      prisma.session.deleteMany({ where: { userId: userId } }),
      prisma.verificationToken.deleteMany({
        where: { identifier: email }, // Note: This uses the email identifier
      }),

      // --- Finally, delete the User ---
      prisma.user.delete({
        where: { id: userId },
      }),
    ]);

    console.log('✅ Successfully deleted all data:');
    
    // ✅ FIX 2: prisma.user.delete() returns the user object, not a count.
    // We can safely log "1" because the transaction would have failed if deletion didn't
    // or we can log the deleted user's ID. Let's just log 1.
    console.log(`- User: 1`); 
    
    console.log(`- Accounts: ${deletedAccounts.count}`);
    console.log(`- Sessions: ${deletedSessions.count}`);
    console.log(`- Bookings: ${deletedBookings.count}`);
    console.log(`- Reviews: ${deletedReviews.count}`);
    console.log(`- Refunds: ${deletedRefunds.count}`);
    console.log(`- Waitlist Entries: ${deletedWaitlist.count}`);
    console.log(`- Activity Logs: ${deletedActivities.count}`);
    console.log(`- Notifications: ${deletedNotifications.count}`);
    console.log(`- Verification Tokens: ${deletedTokens.count}`);
  } catch (error) {
    console.error(
      '❌ Error during deletion transaction. No data was deleted.',
      error,
    );
  } finally {
    // 3. Disconnect the Prisma client
    await prisma.$disconnect();
    console.log('Prisma client disconnected.');
  }
}

// --- Run the script ---
deleteUserAndAllData(USER_EMAIL_TO_DELETE);