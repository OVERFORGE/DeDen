// app/api/user/unlink-google/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // 1. Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Check if user has both Google and Wallet linked
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            provider: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has a wallet account
    const hasWallet = user.accounts.some((acc) => acc.provider === "ethereum");
    const hasGoogle = user.accounts.some((acc) => acc.provider === "google");

    if (!hasGoogle) {
      return NextResponse.json(
        { error: "No Google account is linked" },
        { status: 400 }
      );
    }

    // Prevent unlinking if it's the only auth method
    if (!hasWallet) {
      return NextResponse.json(
        { 
          error: "Cannot unlink Google account. Please link a wallet first to maintain access to your account." 
        },
        { status: 400 }
      );
    }

    // 3. Delete the Google account link and clear email
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: null, // Clear the email
        image: null, // Clear Google profile image
        accounts: {
          deleteMany: {
            provider: "google",
          },
        },
      },
    });

    return NextResponse.json(
      { message: "Google account unlinked successfully" },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Unlink Google API error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}