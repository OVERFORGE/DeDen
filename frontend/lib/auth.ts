// File: lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter, 
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Ethereum",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.message) return null;

          const siwe = new SiweMessage(JSON.parse(credentials.message));
          const nextAuthUrl = new URL(process.env.NEXTAUTH_URL!);

          const result = await siwe.verify({
            signature: credentials.signature || "",
            domain: nextAuthUrl.host,
            nonce: siwe.nonce,
          });

          if (!result.success) return null;

          const walletAddress = siwe.address;

          // Find account linked to this wallet
          const account = await prisma.account.findFirst({
            where: {
              provider: "ethereum",
              providerAccountId: walletAddress,
            },
          });

          if (account) {
            const user = await prisma.user.findUnique({
              where: { id: account.userId },
            });
            return user;
          }

          return null;
        } catch (e) {
          console.error("Authorize error:", e);
          return null;
        }
      },
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