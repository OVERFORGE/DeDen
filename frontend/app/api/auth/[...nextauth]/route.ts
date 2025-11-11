import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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

          // **FIX: Get nonce from the SIWE message itself**
          // The client sends the nonce as part of the SIWE message
          const nonce = siwe.nonce;

          if (!nonce) {
            console.warn("No nonce found in SIWE message");
            return null;
          }

          const nextAuthUrl = new URL(process.env.NEXTAUTH_URL!);

          // Verify the signature
          const result = await siwe.verify({
            signature: credentials.signature || "",
            domain: nextAuthUrl.host,
            nonce: nonce, // Use the nonce from the SIWE message
          });

          if (!result.success) {
            console.warn("SIWE verification failed:", result.error);
            return null;
          }

          const walletAddress = siwe.address;

          // Check if wallet is already linked to a user
          const account = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "ethereum",
                providerAccountId: walletAddress,
              },
            },
          });

          if (account) {
            // Found account, return the associated user
            const user = await prisma.user.findUnique({
              where: { id: account.userId },
            });
            return user;
          }

          // No account found, create a new user and link the wallet
          const user = await prisma.user.create({
            data: {
              displayName: `User ${walletAddress.substring(
                0,
                6
              )}...${walletAddress.substring(walletAddress.length - 4)}`,
              walletAddress: walletAddress,
              accounts: {
                create: {
                  provider: "ethereum",
                  providerAccountId: walletAddress,
                  type: "credentials",
                },
              },
            },
          });

          return user;
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
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;

        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            email: true,
            displayName: true,
            walletAddress: true,
            image: true,
          },
        });

        if (user) {
          (session.user as any).walletAddress = user.walletAddress;
          session.user.name = user.displayName;
          session.user.email = user.email;
          session.user.image = user.image;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },

  pages: {
    signIn: "/auth/signin",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };