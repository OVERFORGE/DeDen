// File: lib/env.ts
// Fails fast on missing required config instead of letting it surface as a
// cryptic runtime error deep in a payment flow (e.g. RESEND_API_KEY missing
// only shows up the moment someone applies for a stay and an email needs
// sending). Import this once from a module every request touches — see
// app/layout.tsx.

const REQUIRED = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'RESEND_API_KEY'] as const;

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`[env] Missing required environment variable(s): ${missing.join(', ')}`);
  }

  // TICKET_QR_SECRET falls back to NEXTAUTH_SECRET (see lib/ticket-service.ts)
  // — that's an accepted default, not an error, so only warn.
  if (!process.env.TICKET_QR_SECRET) {
    console.warn('[env] TICKET_QR_SECRET not set — falling back to NEXTAUTH_SECRET for ticket QR signing.');
  }
}

validateEnv();

export {};
