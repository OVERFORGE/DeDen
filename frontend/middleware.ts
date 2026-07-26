import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// NOTE: This file MUST be named `middleware.ts` at the project root for
// Next.js to load it. It previously lived at `proxy.ts`, which Next.js
// never executes — meaning /admin was only ever gated client-side.
export default withAuth(
  /**
   * This function runs *after* the user is confirmed to be logged in
   * (based on the `authorized` callback below).
   */
  function middleware(req) {
    const { token } = req.nextauth; // The user's session token
    const { pathname } = req.nextUrl; // The path they are trying to access

    // --- Admin Route Protection ---
    if (pathname.startsWith("/admin")) {
      if (token?.userRole !== "ADMIN") {
        const forbiddenUrl = new URL("/dashboard?error=forbidden", req.url);
        return NextResponse.redirect(forbiddenUrl);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      /**
       * Runs first. If it returns false, the user is redirected to `signIn`.
       * If true, the `middleware` function above runs.
       */
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

// Page routes only. API routes (/api/admin/**) are protected in-handler via
// lib/api-auth.ts so they can return a proper 401/403 JSON body instead of
// an HTML redirect.
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
