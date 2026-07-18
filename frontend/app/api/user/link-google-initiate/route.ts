// app/api/user/link-google-initiate/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Initiates Google OAuth linking by generating a special state parameter
 * that preserves the current user's session context
 */
export async function GET(req: Request) {
  try {
    // 1. Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Generate OAuth state with user context
    const state = JSON.stringify({
      userId: userId,
      action: "link-google",
      timestamp: Date.now(),
    });

    // 3. Encode state for URL safety
    const encodedState = Buffer.from(state).toString("base64url");

    // 4. Build Google OAuth URL with custom state
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    googleAuthUrl.searchParams.set("redirect_uri", `${process.env.NEXTAUTH_URL}/api/auth/callback/google`);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid profile email");
    googleAuthUrl.searchParams.set("state", encodedState);

    return NextResponse.json({
      url: googleAuthUrl.toString(),
    });
  } catch (error: any) {
    console.error("Link Google initiate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate Google linking" },
      { status: 500 }
    );
  }
}