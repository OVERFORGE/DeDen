import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters"; // ✅ ADD THIS IMPORT
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
      async authorize(credentials, req) {
        try {
          if (!credentials) {
            console.warn("No credentials provided");
            return null;
          }

          const siwe = new SiweMessage(JSON.parse(credentials.message || "{}"));
          const nonce = siwe.nonce;

          if (!nonce) {
            console.warn("No nonce found in SIWE message");
            return null;
          }

          const nextAuthUrl = new URL(process.env.NEXTAUTH_URL!);

          const result = await siwe.verify({
            signature: credentials.signature || "",
            domain: nextAuthUrl.host,
            nonce: nonce,
          });

          if (!result.success) {
            console.warn("SIWE verification failed:", result.error);
            return null;
          }

          const walletAddress = siwe.address;

          const account = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "ethereum",
                providerAccountId: walletAddress,
              },
            },
          });

          if (account) {
            const user = await prisma.user.findUnique({
              where: { id: account.userId },
            });
            return user; // ✅ This user object will include `userRole`
          }

          console.warn(
            `Wallet login failed: Wallet ${walletAddress} is not linked to any existing user account.`
          );
          return null;
        } catch (e) {
          console.error("Authorize error:", e);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    /**
     * ✅ UPDATED: This callback adds the userRole to the JWT.
     * This is essential for the middleware to be able to check permissions.
     */
    async jwt({ token, user }) {
      if (user) {
        // On initial sign in, `user` object is available
        token.sub = user.id;
        token.userRole = user.userRole; // Add the role to the token
      }
      return token;
    },

    /**
     * ✅ UPDATED: This callback adds the userRole to the session object.
     * This is so you can access it on the client-side (e.g., in AdminLayout).
     */
    async session({ session, token }) {
      if (session.user && token.sub) {
        // 1. Add ID and Role directly from the token
        session.user.id = token.sub;
        session.user.userRole = token.userRole;

        // 2. Your existing logic to get other user details from the DB
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            // Note: We don't need to re-fetch id or userRole
            // They are already in the token.
            email: true,
            displayName: true,
            walletAddress: true,
            image: true,
          },
        });

        if (dbUser) {
          (session.user as any).walletAddress = dbUser.walletAddress;
          session.user.name = dbUser.displayName;
          session.user.email = dbUser.email;
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };