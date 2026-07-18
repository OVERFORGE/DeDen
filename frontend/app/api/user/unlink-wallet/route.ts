// app/api/user/unlink-wallet/route.ts
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

    // 2. Check if user has a wallet linked
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (!user?.walletAddress) {
      return NextResponse.json(
        { error: "No wallet is linked to this account" },
        { status: 400 }
      );
    }

    // 3. Delete the ethereum account link and clear wallet address
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: null, // Clear the wallet address
        accounts: {
          deleteMany: {
            provider: "ethereum",
          },
        },
      },
    });

    return NextResponse.json(
      { message: "Wallet unlinked successfully" },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Unlink wallet API error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}