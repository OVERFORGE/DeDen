import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();

vi.mock("@/lib/database", () => ({
  db: {
    stay: {
      findUnique: (...args: any[]) => findUnique(...args),
      update: (...args: any[]) => update(...args),
    },
  },
}));

const { holdStaySlots, releaseStaySlots, hasAvailableSlots } = await import("@/lib/inventory");

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
});

describe("holdStaySlots", () => {
  it("decrements slotsAvailable by guestCount", async () => {
    findUnique.mockResolvedValue({ slotsAvailable: 10 });
    await holdStaySlots("stay-1", 3);
    expect(update).toHaveBeenCalledWith({
      where: { id: "stay-1" },
      data: { slotsAvailable: 7 },
    });
  });

  it("clamps at 0 instead of going negative", async () => {
    findUnique.mockResolvedValue({ slotsAvailable: 2 });
    await holdStaySlots("stay-1", 5);
    expect(update).toHaveBeenCalledWith({
      where: { id: "stay-1" },
      data: { slotsAvailable: 0 },
    });
  });

  it("is a no-op for zero or negative guestCount", async () => {
    await holdStaySlots("stay-1", 0);
    await holdStaySlots("stay-1", -1);
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("is a no-op when the stay doesn't exist", async () => {
    findUnique.mockResolvedValue(null);
    await holdStaySlots("missing-stay", 2);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("releaseStaySlots", () => {
  it("increments slotsAvailable by guestCount", async () => {
    findUnique.mockResolvedValue({ slotsAvailable: 5, slotsTotal: 20 });
    await releaseStaySlots("stay-1", 3);
    expect(update).toHaveBeenCalledWith({
      where: { id: "stay-1" },
      data: { slotsAvailable: 8 },
    });
  });

  it("clamps at slotsTotal instead of exceeding capacity", async () => {
    findUnique.mockResolvedValue({ slotsAvailable: 18, slotsTotal: 20 });
    await releaseStaySlots("stay-1", 5);
    expect(update).toHaveBeenCalledWith({
      where: { id: "stay-1" },
      data: { slotsAvailable: 20 },
    });
  });
});

describe("hasAvailableSlots", () => {
  it("returns true when enough slots remain", async () => {
    findUnique.mockResolvedValue({ slotsAvailable: 5 });
    expect(await hasAvailableSlots("stay-1", 3)).toBe(true);
  });

  it("returns false when not enough slots remain", async () => {
    findUnique.mockResolvedValue({ slotsAvailable: 2 });
    expect(await hasAvailableSlots("stay-1", 3)).toBe(false);
  });

  it("returns false when the stay doesn't exist", async () => {
    findUnique.mockResolvedValue(null);
    expect(await hasAvailableSlots("missing-stay", 1)).toBe(false);
  });
});
