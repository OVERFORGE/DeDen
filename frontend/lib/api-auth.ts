// File: lib/api-auth.ts
// Shared authorization guards for API routes. Every route that touches
// admin data, another user's data, or background-job endpoints should use
// one of these instead of rolling its own check.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/database";

export class ApiAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[api-auth] Unexpected error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * Requires a logged-in user. Throws ApiAuthError(401) otherwise.
 */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiAuthError(401, "Not authenticated");
  }
  return { userId: session.user.id as string, session };
}

/**
 * Requires a logged-in user with userRole === 'ADMIN'.
 * Throws ApiAuthError(401) if not logged in, 403 if not an admin.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiAuthError(401, "Not authenticated");
  }
  if (session.user.userRole !== "ADMIN") {
    throw new ApiAuthError(403, "Admin access required");
  }
  return { userId: session.user.id as string, session };
}

/**
 * For background-job / maintenance endpoints (no Vercel Cron available yet).
 * Accepts either an authenticated admin session OR a Bearer JOB_SECRET header,
 * so the same endpoint can be triggered from the admin panel or by an
 * external free scheduler (GitHub Actions, cron-job.org, etc).
 */
export async function requireAdminOrJob(request: Request) {
  const authHeader = request.headers.get("authorization");
  const jobSecret = process.env.JOB_SECRET;

  if (authHeader && jobSecret && authHeader === `Bearer ${jobSecret}`) {
    return { via: "job-secret" as const };
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.id && session.user.userRole === "ADMIN") {
    return { via: "admin-session" as const, userId: session.user.id as string };
  }

  throw new ApiAuthError(401, "Not authorized to run this job");
}

/**
 * Requires the current session user to either own the booking or be an admin.
 * Returns the booking row (with id, bookingId, userId, status) plus the caller info.
 */
export async function requireBookingOwner(bookingId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiAuthError(401, "Not authenticated");
  }

  const booking = await db.booking.findUnique({
    where: { bookingId },
  });

  if (!booking) {
    throw new ApiAuthError(404, "Booking not found");
  }

  const isOwner = booking.userId === session.user.id;
  const isAdmin = session.user.userRole === "ADMIN";

  if (!isOwner && !isAdmin) {
    throw new ApiAuthError(403, "You do not have access to this booking");
  }

  return { booking, userId: session.user.id as string, isAdmin };
}
