import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.TICKET_QR_SECRET = "test-secret-do-not-use-in-prod";
});

const { signQrToken, verifyQrToken } = await import("@/lib/ticket-service");

describe("signQrToken / verifyQrToken", () => {
  it("round-trips a valid token back to its ticketCode", () => {
    const token = signQrToken("TKT-EVENT-123-1");
    const result = verifyQrToken(token);
    expect(result.valid).toBe(true);
    expect(result.ticketCode).toBe("TKT-EVENT-123-1");
  });

  it("rejects a tampered payload (ticketCode swapped post-signing)", () => {
    const token = signQrToken("TKT-EVENT-123-1");
    const [payloadB64, hmac] = token.split(".");
    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const [, nonce] = payload.split(".");
    const forgedPayload = `TKT-EVENT-999-1.${nonce}`;
    const forgedToken = `${Buffer.from(forgedPayload).toString("base64url")}.${hmac}`;

    const result = verifyQrToken(forgedToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Signature mismatch");
  });

  it("rejects a token with a bit flipped in the HMAC", () => {
    const token = signQrToken("TKT-EVENT-123-1");
    const [payloadB64, hmac] = token.split(".");
    const flipped = hmac.slice(0, -1) + (hmac.at(-1) === "A" ? "B" : "A");
    const result = verifyQrToken(`${payloadB64}.${flipped}`);
    expect(result.valid).toBe(false);
  });

  it("rejects malformed tokens (missing separator, empty string, garbage)", () => {
    expect(verifyQrToken("").valid).toBe(false);
    expect(verifyQrToken("not-a-real-token").valid).toBe(false);
    expect(verifyQrToken("a.b.c").valid).toBe(false);
  });

  it("produces a different token each time (nonce), but both verify to the same ticketCode", () => {
    const a = signQrToken("TKT-EVENT-123-1");
    const b = signQrToken("TKT-EVENT-123-1");
    expect(a).not.toBe(b);
    expect(verifyQrToken(a).ticketCode).toBe("TKT-EVENT-123-1");
    expect(verifyQrToken(b).ticketCode).toBe("TKT-EVENT-123-1");
  });
});
