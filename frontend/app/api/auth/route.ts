import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // This function runs for protected routes
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect /dashboard routes
        if (req.nextUrl.pathname.startsWith("/dashboard")) {
          return !!token;
        }
        return true;
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

// Specify which routes to run middleware on
export const config = {
  matcher: ["/dashboard/:path*"],
};