// lib/prisma.ts - Enhanced Version with Advanced Features
import { PrismaClient } from '@prisma/client';

/**
 * Enhanced PrismaClient Singleton
 * 
 * Features:
 * - Singleton pattern to prevent multiple instances
 * - Environment-aware logging
 * - Connection lifecycle management
 * - Graceful shutdown handling
 */

declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    // Logging configuration
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
          ]
        : [{ level: 'error', emit: 'stdout' }],
    
    // Connection pool configuration (optional - uncomment if needed)
    // datasources: {
    //   db: {
    //     url: process.env.DATABASE_URL,
    //   },
    // },
  });
};

// Create singleton instance
export const prisma = globalThis.prisma ?? prismaClientSingleton();

// Log queries in development (optional)
if (process.env.NODE_ENV === 'development') {
  globalThis.prisma = prisma;
  
  // Log all queries with timing
  prisma.$on('query' as never, (e: any) => {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  });
}

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
  const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default prisma;