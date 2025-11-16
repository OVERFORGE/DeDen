import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export const proxy = withAuth(
  /**
   * This function runs *after* the user is confirmed to be logged in
   * (based on the `authorized` callback below).
   */
  function middleware(req) {
    const { token } = req.nextauth; // The user's session token
    const { pathname } = req.nextUrl; // The path they are trying to access

    // --- 1. Admin Route Protection ---
    // Check if the user is trying to access an /admin route
    if (pathname.startsWith("/admin")) {
      // If they are, check if their role is NOT 'ADMIN'
      if (token?.userRole !== "ADMIN") {
        // If they are not an admin, redirect them to the dashboard
        // (or any other page you prefer, like a "forbidden" page)
        const forbiddenUrl = new URL('/dashboard?error=forbidden', req.url);
        return NextResponse.redirect(forbiddenUrl);
      }
    }

    // --- 2. Allow Request ---
    // If the user is:
    // 1. An ADMIN accessing /admin
    // 2. Any logged-in user accessing /dashboard
    // ...then allow the request to proceed.
    return NextResponse.next();
  },
  {
    callbacks: {
      /**
       * This callback runs first. It checks if the user is logged in.
       * If it returns `false`, the user is redirected to the `signIn` page.
       * If it returns `true`, the `middleware` function above is executed.
       */
      authorized: ({ token }) => {
        // !!token means "return true if the token exists (is logged in)"
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/signin", // Your custom sign-in page
    },
  }
);

// ✅ UPDATED Matcher
export const config = {
  // This matcher applies the auth logic to *both* sets of routes
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*", // Add the admin path
  ],
};