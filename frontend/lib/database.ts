// File: app/lib/database.ts

import { PrismaClient } from '@prisma/client';

// This is a common pattern for Next.js to prevent creating
// too many database connections in development (due to hot reloading).
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Create the 'db' client if it doesn't already exist
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // You can add logging here to see your database queries
    // log: ['query'], 
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}