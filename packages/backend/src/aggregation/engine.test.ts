import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  prisma: {
    taskDefinition: { findMany: vi.fn() },
    progressSnapshot: { upsert: vi.fn() },
  },
}));
vi.mock("../event-store.js", () => ({
  getEvents: vi.fn(),
}));

describe("aggregation engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports computeProgressState and getProgressAggregated", async () => {
    const { computeProgressState, getProgressAggregated } = await import("./engine.js");
    expect(typeof computeProgressState).toBe("function");
    expect(typeof getProgressAggregated).toBe("function");
  });
});
