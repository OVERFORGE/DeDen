// app/api/user/link-google/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // 1. Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Parse the request body - Google account info from OAuth callback
    const { googleAccountId, email, name, image } = await req.json();

    if (!googleAccountId || !email) {
      return NextResponse.json(
        { error: "Missing Google account information" },
        { status: 400 }
      );
    }

    // 3. Check if this Google account is already linked to ANOTHER user
    const existingAccount = await prisma.account.findFirst({
      where: {
        provider: "google",
        providerAccountId: googleAccountId,
        userId: {
          not: userId,
        },
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: "This Google account is already linked to another user." },
        { status: 409 }
      );
    }

    // 4. Link the Google account to the current user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email,
        displayName: name || undefined,
        image: image || undefined,
        accounts: {
          upsert: {
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: googleAccountId,
              },
            },
            create: {
              provider: "google",
              providerAccountId: googleAccountId,
              type: "oauth",
              access_token: "", // You'd get this from the OAuth flow
              token_type: "bearer",
              scope: "openid profile email",
            },
            update: {},
          },
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        walletAddress: true,
        image: true,
      },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (e: any) {
    console.error("Link Google API error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}