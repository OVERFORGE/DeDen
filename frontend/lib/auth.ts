// File: lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.userRole = user.userRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.userRole = token.userRole;
        
        // Fetch fresh data if needed (optional optimization: remove if performance is slow)
        const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { walletAddress: true, displayName: true, image: true }
        });
        
        if (dbUser) {
            (session.user as any).walletAddress = dbUser.walletAddress;
            session.user.name = dbUser.displayName;
            session.user.image = dbUser.image;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};