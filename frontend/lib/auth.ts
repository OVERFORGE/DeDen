// File: lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { SiweMessage } from "siwe";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Recovers the CSRF token NextAuth actually issued for this request, by
 * reading its signed cookie and validating the hash — the same way NextAuth
 * itself validates it internally (see next-auth/core/lib/csrf-token).
 *
 * The SIWE message's `nonce` field must equal this value. Previously the
 * authorize() callback compared the message's nonce against itself
 * (`siwe.nonce === siwe.nonce`), which is always true and made the nonce
 * check a no-op — a captured signed message could be replayed indefinitely.
 */
function getExpectedCsrfToken(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }

  const raw =
    cookies["__Host-next-auth.csrf-token"] ||
    cookies["__Secure-next-auth.csrf-token"] ||
    cookies["next-auth.csrf-token"];

  if (!raw) return null;

  const [token, hash] = raw.split("|");
  const secret = process.env.NEXTAUTH_SECRET;
  if (!token || !hash || !secret) return null;

  const expectedHash = createHash("sha256").update(`${token}${secret}`).digest("hex");
  if (expectedHash !== hash) return null;

  return token;
}

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
          if (!credentials?.message) return null;

          const siwe = new SiweMessage(JSON.parse(credentials.message));
          const nextAuthUrl = new URL(process.env.NEXTAUTH_URL!);

          // ✅ Verify against the CSRF cookie actually issued for this
          // request/session, not the nonce embedded in the message itself.
          const cookieHeader = (req?.headers as any)?.cookie as string | undefined;
          const expectedNonce = getExpectedCsrfToken(cookieHeader);

          if (!expectedNonce || siwe.nonce !== expectedNonce) {
            console.error("Authorize error: missing or mismatched CSRF nonce");
            return null;
          }

          const result = await siwe.verify({
            signature: credentials.signature || "",
            domain: nextAuthUrl.host,
            nonce: expectedNonce,
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