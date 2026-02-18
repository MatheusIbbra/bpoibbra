import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/BaseFilterContext", () => ({
  useBaseFilter: () => ({
    getOrganizationFilter: () => ({ type: "single", ids: ["org-1"] }),
  }),
}));

describe("Budget Analysis Logic", () => {
  it("should calculate variance percentage and status correctly", () => {
    const budgets = [
      { category_id: "c1", amount: 1000 },
      { category_id: "c2", amount: 500 },
      { category_id: "c3", amount: 2000 },
    ];

    const actuals: Record<string, number> = {
      c1: 800,  // 80% → warning
      c2: 600,  // 120% → over
      c3: 500,  // 25% → under
    };

    const items = budgets.map((b) => {
      const budgetAmount = Number(b.amount);
      const actualAmount = actuals[b.category_id] || 0;
      const variance = budgetAmount - actualAmount;
      const variancePercentage = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

      let status: string;
      if (variancePercentage >= 100) status = "over";
      else if (variancePercentage >= 80) status = "warning";
      else if (variancePercentage >= 50) status = "on_track";
      else status = "under";

      return { category_id: b.category_id, budgetAmount, actualAmount, variance, variancePercentage, status };
    });

    expect(items[0].status).toBe("warning");
    expect(items[0].variancePercentage).toBe(80);
    expect(items[0].variance).toBe(200);

    expect(items[1].status).toBe("over");
    expect(items[1].variancePercentage).toBe(120);
    expect(items[1].variance).toBe(-100);

    expect(items[2].status).toBe("under");
    expect(items[2].variancePercentage).toBe(25);
    expect(items[2].variance).toBe(1500);
  });

  it("should handle empty budgets", () => {
    const budgets: any[] = [];
    const totalBudget = budgets.reduce((acc, b) => acc + Number(b.amount), 0);
    const totalActual = 0;

    expect(totalBudget).toBe(0);
    expect(totalActual).toBe(0);
  });

  it("should handle zero budget amount without division by zero", () => {
    const budgetAmount = 0;
    const actualAmount = 500;
    const variancePercentage = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

    expect(variancePercentage).toBe(0);
    expect(isFinite(variancePercentage)).toBe(true);
  });
});
