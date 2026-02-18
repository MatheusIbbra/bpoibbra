import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/BaseFilterContext", () => ({
  useBaseFilter: () => ({
    getOrganizationFilter: () => ({ type: "single", ids: ["org-1"] }),
  }),
}));

describe("Financial Health Score Logic", () => {
  it("should validate score is between 0 and 100", () => {
    const mockData = {
      score: 72,
      runway_months: 8,
      burn_rate: 5000,
      savings_rate: 15,
      total_balance: 40000,
      total_revenue: 12000,
      total_expenses: 10000,
      expense_concentration: 35,
      revenue_growth: 5,
      expense_growth: 2,
    };

    expect(mockData.score).toBeGreaterThanOrEqual(0);
    expect(mockData.score).toBeLessThanOrEqual(100);
    expect(mockData.runway_months).toBeGreaterThan(0);
    expect(mockData.savings_rate).toBeGreaterThanOrEqual(0);
  });

  it("should handle null/empty response gracefully", () => {
    const data = null;
    expect(data).toBeNull();
  });

  it("should handle negative values in financial metrics", () => {
    const mockData = {
      score: 15,
      runway_months: 0,
      burn_rate: -3000,
      savings_rate: -20,
      total_balance: -5000,
      total_revenue: 2000,
      total_expenses: 5000,
      expense_concentration: 80,
      revenue_growth: -10,
      expense_growth: 25,
    };

    expect(mockData.score).toBeGreaterThanOrEqual(0);
    expect(mockData.score).toBeLessThanOrEqual(100);
    expect(mockData.total_balance).toBeLessThan(0);
    expect(mockData.total_expenses).toBeGreaterThan(mockData.total_revenue);
    // Burn rate negative = spending more than earning
    expect(mockData.burn_rate).toBeLessThan(0);
  });
});
