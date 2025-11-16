// File: lib/auth.ts
// NextAuth configuration WITHOUT Prisma Adapter (JWT Sessions Only)
// Deploy to: /lib/auth.ts

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import {prisma} from '@/lib/prisma'; // For user lookups only

/**
 * NextAuth Configuration - JWT Session Strategy
 * 
 * This version uses JWT sessions (no adapter needed)
 * - Faster (no database calls for each session check)
 * - Simpler setup (no adapter required)
 * - Still connects to database for user data
 * 
 * Note: Sessions are stored in JWT tokens, not database
 */
export const authOptions: NextAuthOptions = {
  // Authentication providers
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

  
  ],

  // Session configuration - JWT strategy (no database)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Custom pages
  pages: {
    signIn: '/auth/signin',
    // signOut: '/auth/signout',
    // error: '/auth/error',
  },

  // Callbacks
  callbacks: {
    /**
     * JWT Callback
     * Runs when JWT is created or updated
     */
    async jwt({ token, user, account, profile, trigger }) {
      // Initial sign in
      if (user) {
        // Create or update user in database
        const dbUser = await prisma.user.upsert({
          where: { email: user.email! },
          update: {
            name: user.name,
            image: user.image,
          },
          create: {
            email: user.email!,
            name: user.name,
            image: user.image,
            role: 'USER', // Default role
          },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            firstName: true,
            lastName: true,
            mobileNumber: true,
            gender: true,
            age: true,
            socialTwitter: true,
            socialLinkedin: true,
            socialTelegram: true,
          },
        });

        // Add user data to token
        token.id = dbUser.id;
        token.email = dbUser.email;
        token.name = dbUser.name;
        token.picture = dbUser.image;
        token.role = dbUser.role;
        token.firstName = dbUser.firstName;
        token.lastName = dbUser.lastName;
        token.mobileNumber = dbUser.mobileNumber;
        token.gender = dbUser.gender;
        token.age = dbUser.age;
        token.socialTwitter = dbUser.socialTwitter;
        token.socialLinkedin = dbUser.socialLinkedin;
        token.socialTelegram = dbUser.socialTelegram;
      }

      // Handle updates (when user data changes)
      if (trigger === 'update' && token.email) {
        const updatedUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            firstName: true,
            lastName: true,
            mobileNumber: true,
            gender: true,
            age: true,
            socialTwitter: true,
            socialLinkedin: true,
            socialTelegram: true,
          },
        });

        if (updatedUser) {
          token.name = updatedUser.name;
          token.picture = updatedUser.image;
          token.role = updatedUser.role;
          token.firstName = updatedUser.firstName;
          token.lastName = updatedUser.lastName;
          token.mobileNumber = updatedUser.mobileNumber;
          token.gender = updatedUser.gender;
          token.age = updatedUser.age;
          token.socialTwitter = updatedUser.socialTwitter;
          token.socialLinkedin = updatedUser.socialLinkedin;
          token.socialTelegram = updatedUser.socialTelegram;
        }
      }

      return token;
    },

    /**
     * Session Callback
     * Runs whenever session is checked
     */
    async session({ session, token }) {
      if (token && session.user) {
        // Add user data to session
        (session.user as any).id = token.id as string;
        (session.user as any).email = token.email as string;
        (session.user as any).name = token.name as string;
        (session.user as any).image = token.picture as string;
        (session.user as any).role = token.role as string;
        (session.user as any).firstName = token.firstName;
        (session.user as any).lastName = token.lastName;
        (session.user as any).mobileNumber = token.mobileNumber;
        (session.user as any).gender = token.gender;
        (session.user as any).age = token.age;
        (session.user as any).socialTwitter = token.socialTwitter;
        (session.user as any).socialLinkedin = token.socialLinkedin;
        (session.user as any).socialTelegram = token.socialTelegram;
      }

      return session;
    },

    /**
     * Sign In Callback
     */
    async signIn({ user, account, profile }) {
      // Allow all sign-ins
      return true;
    },

    /**
     * Redirect Callback
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl + '/dashboard';
    },
  },

  // Events
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`[Auth] User signed in: ${user.email}`);
      
      // Log sign-in activity - using correct ActivityLog schema fields
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (dbUser) {
          await prisma.activityLog.create({
            data: {
              userId: dbUser.id,
              action: 'SIGN_IN',
              entity: 'User',
              entityId: dbUser.id,
              details: {
                provider: account?.provider || 'unknown',
                isNewUser,
                email: user.email,
                name: user.name,
                description: `Signed in via ${account?.provider || 'unknown'}`,
              },
            },
          });
        }
      } catch (error) {
        console.error('[Auth] Failed to log sign-in:', error);
      }
    },

    async signOut({ token }) {
      console.log(`[Auth] User signed out: ${token?.email}`);
    },
  },

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',

  // Secret for JWT encryption
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;