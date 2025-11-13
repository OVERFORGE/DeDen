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

    // 2. Parse the request body - Google account info
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
        { status: 409 } // 409 Conflict
      );
    }

    // --- ⬇️ START: THE FIX ⬇️ ---

    // 4. Check if the email from Google is already used by ANOTHER user
    const existingEmailUser = await prisma.user.findFirst({
      where: {
        email: email,
        id: {
          not: userId, // Check for users other than the current one
        },
      },
    });

    if (existingEmailUser) {
      return NextResponse.json(
        { error: "This email address is already in use by another account." },
        { status: 409 } // 409 Conflict
      );
    }

    // --- ⬆️ END: THE FIX ⬆️ ---

    // 5. Link the Google account to the current user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email, // This is now safe
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
              access_token: "", // Note: You should pass the real tokens here
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

    // Provide a specific error for unique constraint violation
    if (e.code === "P2002") {
      // Prisma's unique constraint failed code
      return NextResponse.json(
        { error: "An account with this email or provider is already linked." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}