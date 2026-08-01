// Guards the txHash-replay fix. Transaction hashes are public on-chain data,
// so the "has this tx already been credited?" check is the only thing
// stopping someone from confirming their own booking with someone else's
// payment.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/database", () => ({
  db: {
    booking: { findMany: (...args: any[]) => findMany(...args) },
  },
}));

vi.mock("@/lib/web3-client", () => ({ getPublicClient: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendConfirmationEmail: vi.fn(),
  sendReservationConfirmedEmail: vi.fn(),
}));
vi.mock("@/lib/nft-service", () => ({ mintBookingNFT: vi.fn() }));
vi.mock("@/lib/inventory", () => ({ recomputeStayAvailability: vi.fn() }));
vi.mock("@/lib/ticket-service", () => ({
  issueTicketsForBooking: vi.fn(),
  getTicketEmailPayload: vi.fn(),
}));

const { findConflictingTxUsage } = await import("@/lib/verification");

const TX = "0xdeadbeef";

beforeEach(() => findMany.mockReset());

describe("findConflictingTxUsage", () => {
  it("returns null when the tx has never been used", async () => {
    findMany.mockResolvedValue([]);
    expect(await findConflictingTxUsage(TX, "MY-BOOKING", "full")).toBeNull();
  });

  it("blocks a tx already confirmed on ANOTHER booking (the core exploit)", async () => {
    findMany.mockResolvedValue([
      {
        bookingId: "VICTIM-BOOKING",
        txHash: TX,
        status: "CONFIRMED",
        reservationTxHash: null,
        reservationPaid: false,
        remainingTxHash: null,
        remainingPaid: false,
      },
    ]);
    const conflict = await findConflictingTxUsage(TX, "ATTACKER-BOOKING", "full");
    expect(conflict).toEqual({ bookingId: "VICTIM-BOOKING", leg: "full" });
  });

  it("blocks another booking's reservation tx being reused", async () => {
    findMany.mockResolvedValue([
      {
        bookingId: "VICTIM-BOOKING",
        txHash: null,
        status: "RESERVED",
        reservationTxHash: TX,
        reservationPaid: true,
        remainingTxHash: null,
        remainingPaid: false,
      },
    ]);
    const conflict = await findConflictingTxUsage(TX, "ATTACKER-BOOKING", "reservation");
    expect(conflict).toEqual({ bookingId: "VICTIM-BOOKING", leg: "reservation" });
  });

  it("blocks reusing your OWN reservation tx as the remaining payment", async () => {
    // Self-dealing variant: pay the $30 deposit, then submit that same tx
    // again as the balance payment to get fully confirmed for $30.
    findMany.mockResolvedValue([
      {
        bookingId: "MY-BOOKING",
        txHash: null,
        status: "RESERVED",
        reservationTxHash: TX,
        reservationPaid: true,
        remainingTxHash: null,
        remainingPaid: false,
      },
    ]);
    const conflict = await findConflictingTxUsage(TX, "MY-BOOKING", "remaining");
    expect(conflict).toEqual({ bookingId: "MY-BOOKING", leg: "reservation" });
  });

  it("stays idempotent: re-verifying the same booking's same leg is allowed", async () => {
    findMany.mockResolvedValue([
      {
        bookingId: "MY-BOOKING",
        txHash: null,
        status: "RESERVED",
        reservationTxHash: TX,
        reservationPaid: true,
        remainingTxHash: null,
        remainingPaid: false,
      },
    ]);
    expect(await findConflictingTxUsage(TX, "MY-BOOKING", "reservation")).toBeNull();
  });

  it("ignores an unpaid leg that merely references the tx", async () => {
    // reservationTxHash set but reservationPaid false => not yet consumed.
    findMany.mockResolvedValue([
      {
        bookingId: "OTHER",
        txHash: null,
        status: "PENDING",
        reservationTxHash: TX,
        reservationPaid: false,
        remainingTxHash: null,
        remainingPaid: false,
      },
    ]);
    expect(await findConflictingTxUsage(TX, "MY-BOOKING", "reservation")).toBeNull();
  });
});
