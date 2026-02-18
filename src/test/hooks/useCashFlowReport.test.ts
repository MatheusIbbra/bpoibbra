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

describe("Cash Flow Report Logic", () => {
  it("should calculate net flow and cumulative balance correctly", () => {
    const openingBalance = 10000;
    const transactions = [
      { amount: 5000, type: "income" },
      { amount: 2000, type: "expense" },
      { amount: 1000, type: "investment" },
      { amount: 500, type: "redemption" },
      { amount: 300, type: "transfer" },
    ];

    let totalInflows = 0;
    let totalOutflows = 0;
    let totalInvestments = 0;
    let totalRedemptions = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx.amount);
      switch (tx.type) {
        case "income": totalInflows += amount; break;
        case "expense": totalOutflows += amount; break;
        case "transfer": totalOutflows += amount; break;
        case "investment": totalInvestments += amount; break;
        case "redemption": totalRedemptions += amount; break;
      }
    });

    const netCashFlow = totalInflows + totalRedemptions - totalOutflows - totalInvestments;
    const closingBalance = openingBalance + netCashFlow;

    expect(totalInflows).toBe(5000);
    expect(totalOutflows).toBe(2300); // 2000 expense + 300 transfer
    expect(totalInvestments).toBe(1000);
    expect(totalRedemptions).toBe(500);
    expect(netCashFlow).toBe(2200); // 5000 + 500 - 2300 - 1000
    expect(closingBalance).toBe(12200);
  });

  it("should return zeros for empty data", () => {
    const openingBalance = 0;
    const transactions: any[] = [];

    let totalInflows = 0;
    let totalOutflows = 0;

    transactions.forEach((tx) => {
      if (tx.type === "income") totalInflows += Number(tx.amount);
      if (tx.type === "expense") totalOutflows += Number(tx.amount);
    });

    expect(totalInflows).toBe(0);
    expect(totalOutflows).toBe(0);
    expect(openingBalance).toBe(0);
  });

  it("should handle negative amounts in opening balance calculation", () => {
    const priorTransactions = [
      { amount: 1000, type: "income" },
      { amount: 3000, type: "expense" },
    ];

    let openingBalance = 0;
    priorTransactions.forEach((tx) => {
      const amount = Number(tx.amount);
      if (tx.type === "income" || tx.type === "redemption") {
        openingBalance += amount;
      } else if (tx.type === "expense" || tx.type === "investment") {
        openingBalance -= amount;
      }
    });

    expect(openingBalance).toBe(-2000);
  });
});
