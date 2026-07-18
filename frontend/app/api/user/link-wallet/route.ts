import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";import { prisma } from "@/lib/prisma";
import { SiweMessage } from "siwe";

export async function POST(req: Request) {
  try {
    // 1. Get the authenticated user's session
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Parse the request body
    const { message, signature } = await req.json();

    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing message or signature" },
        { status: 400 }
      );
    }

    // 3. Verify the SIWE message
    const siweMessage = new SiweMessage(JSON.parse(message));
    const result = await siweMessage.verify({ signature });

    if (!result.success) {
      console.warn("Wallet link SIWE verification failed:", result.error);
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 400 }
      );
    }

    const walletAddress = siweMessage.address;

    // 4. Check if this wallet is already linked to ANOTHER user
    const existingAccount = await prisma.account.findFirst({
      where: {
        provider: "ethereum",
        providerAccountId: walletAddress,
        userId: {
          not: userId, // Check for accounts not belonging to the current user
        },
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: "This wallet is already linked to another account." },
        { status: 409 } // 409 Conflict
      );
    }

    // 5. Link the wallet to the current user
    // We update the User table and create an Account entry
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: walletAddress, // Add to the user's main wallet field
        accounts: {
          // Create the link in the Account table
          // Use `upsert` to avoid duplicates if user links/unlinks/re-links
          upsert: {
            where: {
              provider_providerAccountId: {
                provider: "ethereum",
                providerAccountId: walletAddress,
              },
            },
            create: {
              provider: "ethereum",
              providerAccountId: walletAddress,
              type: "credentials", // Or "oauth" if you consider it so
            },
            update: {}, // Nothing to update if it already exists
          },
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        walletAddress: true,
      },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (e: any) {
    console.error("Link wallet API error:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}