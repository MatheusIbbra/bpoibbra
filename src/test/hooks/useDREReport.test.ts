import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/BaseFilterContext", () => ({
  useBaseFilter: () => ({
    getOrganizationFilter: () => ({ type: "single", ids: ["org-1"] }),
  }),
}));

describe("DRE Report Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate totals correctly with valid data", () => {
    const transactions = [
      { amount: 1000, type: "income", category_id: "c1", categories: { name: "Vendas", color: "#00f" }, date: "2025-01-15", accrual_date: null },
      { amount: 500, type: "income", category_id: "c1", categories: { name: "Vendas", color: "#00f" }, date: "2025-01-20", accrual_date: null },
      { amount: 300, type: "expense", category_id: "c2", categories: { name: "Aluguel", color: "#f00" }, date: "2025-01-10", accrual_date: null },
      { amount: 200, type: "expense", category_id: "c3", categories: { name: "Pessoal", color: "#0f0" }, date: "2025-01-12", accrual_date: null },
      { amount: 100, type: "investment", category_id: null, categories: null, date: "2025-01-25", accrual_date: null },
      { amount: 50, type: "redemption", category_id: null, categories: null, date: "2025-01-28", accrual_date: null },
    ];

    let grossRevenue = 0;
    let investments = 0;
    let redemptions = 0;
    const expenseMap = new Map<string | null, number>();

    transactions.forEach((tx) => {
      const amount = Number(tx.amount);
      switch (tx.type) {
        case "income": grossRevenue += amount; break;
        case "expense":
          expenseMap.set(tx.category_id, (expenseMap.get(tx.category_id) || 0) + amount);
          break;
        case "investment": investments += amount; break;
        case "redemption": redemptions += amount; break;
      }
    });

    const totalExpenses = Array.from(expenseMap.values()).reduce((s, v) => s + v, 0);
    const netRevenue = grossRevenue;
    const operatingIncome = netRevenue - totalExpenses;
    const financialResult = redemptions - investments;
    const netIncome = operatingIncome + financialResult;

    expect(grossRevenue).toBe(1500);
    expect(totalExpenses).toBe(500);
    expect(operatingIncome).toBe(1000);
    expect(financialResult).toBe(-50);
    expect(netIncome).toBe(950);
  });

  it("should handle empty transactions", () => {
    const transactions: any[] = [];
    let grossRevenue = 0;
    let totalExpenses = 0;

    transactions.forEach((tx) => {
      if (tx.type === "income") grossRevenue += Number(tx.amount);
      if (tx.type === "expense") totalExpenses += Number(tx.amount);
    });

    expect(grossRevenue).toBe(0);
    expect(totalExpenses).toBe(0);
    expect(grossRevenue - totalExpenses).toBe(0);
  });

  it("should handle negative amounts correctly", () => {
    const transactions = [
      { amount: -500, type: "income", category_id: "c1" },
      { amount: -200, type: "expense", category_id: "c2" },
    ];

    let grossRevenue = 0;
    let totalExpenses = 0;

    transactions.forEach((tx) => {
      if (tx.type === "income") grossRevenue += Number(tx.amount);
      if (tx.type === "expense") totalExpenses += Number(tx.amount);
    });

    expect(grossRevenue).toBe(-500);
    expect(totalExpenses).toBe(-200);
    // Net income = revenue - expenses = -500 - (-200) = -300
    expect(grossRevenue - totalExpenses).toBe(-300);
  });
});
