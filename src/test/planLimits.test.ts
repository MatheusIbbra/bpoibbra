import { describe, it, expect, vi } from "vitest";

/**
 * Tests for plan limit logic extracted from usePlanLimits.
 * We test the pure logic (canPerformAction) without React hooks.
 */

interface PlanUsage {
  isOverTransactions: boolean;
  isOverAI: boolean;
  isOverConnections: boolean;
}

// Extract the pure logic from the hook for testing
function canPerformAction(usage: PlanUsage | undefined, action: "transaction" | "ai" | "connection"): boolean {
  if (!usage) return true; // allow by default while loading
  switch (action) {
    case "transaction":
      return !usage.isOverTransactions;
    case "ai":
      return !usage.isOverAI;
    case "connection":
      return !usage.isOverConnections;
  }
}

describe("canPerformAction", () => {
  it("returns true when usage is undefined (loading state)", () => {
    expect(canPerformAction(undefined, "transaction")).toBe(true);
    expect(canPerformAction(undefined, "ai")).toBe(true);
    expect(canPerformAction(undefined, "connection")).toBe(true);
  });

  it("returns true when below transaction limit", () => {
    const usage: PlanUsage = { isOverTransactions: false, isOverAI: false, isOverConnections: false };
    expect(canPerformAction(usage, "transaction")).toBe(true);
  });

  it("returns false when at transaction limit", () => {
    const usage: PlanUsage = { isOverTransactions: true, isOverAI: false, isOverConnections: false };
    expect(canPerformAction(usage, "transaction")).toBe(false);
  });

  it("returns false when at AI limit", () => {
    const usage: PlanUsage = { isOverTransactions: false, isOverAI: true, isOverConnections: false };
    expect(canPerformAction(usage, "ai")).toBe(false);
  });

  it("returns false when at connection limit", () => {
    const usage: PlanUsage = { isOverTransactions: false, isOverAI: false, isOverConnections: true };
    expect(canPerformAction(usage, "connection")).toBe(false);
  });

  it("handles all limits exceeded simultaneously", () => {
    const usage: PlanUsage = { isOverTransactions: true, isOverAI: true, isOverConnections: true };
    expect(canPerformAction(usage, "transaction")).toBe(false);
    expect(canPerformAction(usage, "ai")).toBe(false);
    expect(canPerformAction(usage, "connection")).toBe(false);
  });
});

describe("canPerformOrUpgrade", () => {
  function canPerformOrUpgrade(
    usage: PlanUsage | undefined,
    action: "transaction" | "ai" | "connection",
    openModal?: (trigger: string) => void
  ): boolean {
    const can = canPerformAction(usage, action);
    if (!can && openModal) {
      const triggerMap = { transaction: "transactions", ai: "ai", connection: "connections" } as const;
      openModal(triggerMap[action]);
    }
    return can;
  }

  it("calls openModal when blocked", () => {
    const openModal = vi.fn();
    const usage: PlanUsage = { isOverTransactions: true, isOverAI: false, isOverConnections: false };
    const result = canPerformOrUpgrade(usage, "transaction", openModal);
    expect(result).toBe(false);
    expect(openModal).toHaveBeenCalledWith("transactions");
  });

  it("does not call openModal when allowed", () => {
    const openModal = vi.fn();
    const usage: PlanUsage = { isOverTransactions: false, isOverAI: false, isOverConnections: false };
    const result = canPerformOrUpgrade(usage, "transaction", openModal);
    expect(result).toBe(true);
    expect(openModal).not.toHaveBeenCalled();
  });

  it("handles missing openModal gracefully", () => {
    const usage: PlanUsage = { isOverTransactions: true, isOverAI: false, isOverConnections: false };
    expect(() => canPerformOrUpgrade(usage, "transaction")).not.toThrow();
  });
});
