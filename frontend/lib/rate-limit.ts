// File: lib/rate-limit.ts
// Simple in-memory fixed-window rate limiter. Resets on deploy/restart —
// fine for knocking down casual abuse on low-traffic endpoints (contact
// form, ticket verification), not meant to stop a determined distributed
// attacker. For that, a shared store (Redis/Upstash) would be needed.

const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  buckets.set(key, timestamps);
  return timestamps.length > limit;
}

export function getRequestIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
