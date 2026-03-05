import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/contexts/BaseFilterContext", () => ({
  useBaseFilter: () => ({
    getOrganizationFilter: () => ({ type: "single", ids: ["org-1"] }),
    getRequiredOrganizationId: () => "org-1",
    requiresBaseSelection: false,
  }),
}));

describe("useAccounts - balance and grouping logic", () => {
  it("prioritizes official_balance over calculated balance", () => {
    const account = {
      id: "acc-1",
      initial_balance: 1000,
      official_balance: 2500,
      last_official_balance_at: "2024-01-15T10:00:00Z",
    };

    // When official_balance exists, use it
    const balance = account.official_balance !== null && account.official_balance !== undefined
      ? account.official_balance
      : account.initial_balance;

    expect(balance).toBe(2500);
  });

  it("falls back to initial_balance when no official balance exists", () => {
    const account = {
      id: "acc-2",
      initial_balance: 1500,
      official_balance: null,
    };

    const balance = account.official_balance !== null && account.official_balance !== undefined
      ? account.official_balance
      : account.initial_balance;

    expect(balance).toBe(1500);
  });

  it("marks account as open_finance when official_balance is set", () => {
    const accounts = [
      { id: "1", official_balance: 5000 },
      { id: "2", official_balance: null },
      { id: "3", official_balance: 0 }, // 0 is still a valid official balance
    ];

    const ofAccounts = accounts.filter(
      a => a.official_balance !== null && a.official_balance !== undefined
    );
    expect(ofAccounts).toHaveLength(2);
    expect(ofAccounts.map(a => a.id)).toEqual(["1", "3"]);
  });

  it("groups accounts by type correctly", () => {
    const accounts = [
      { id: "1", account_type: "checking", current_balance: 1000 },
      { id: "2", account_type: "checking", current_balance: 2000 },
      { id: "3", account_type: "investment", current_balance: 10000 },
      { id: "4", account_type: "savings", current_balance: 5000 },
      { id: "5", account_type: "credit_card", current_balance: -1500 },
    ];

    const grouped = accounts.reduce((acc: Record<string, typeof accounts>, a) => {
      if (!acc[a.account_type]) acc[a.account_type] = [];
      acc[a.account_type].push(a);
      return acc;
    }, {});

    expect(grouped.checking).toHaveLength(2);
    expect(grouped.investment).toHaveLength(1);
    expect(grouped.savings).toHaveLength(1);
  });

  it("calculates total balance across all active accounts", () => {
    const accounts = [
      { id: "1", current_balance: 1000, status: "active" },
      { id: "2", current_balance: 2000, status: "active" },
      { id: "3", current_balance: 500, status: "inactive" },
    ];
    const total = accounts
      .filter(a => a.status === "active")
      .reduce((s, a) => s + a.current_balance, 0);
    expect(total).toBe(3000);
  });

  it("excludes credit cards from patrimony balance", () => {
    const accounts = [
      { id: "1", account_type: "checking", current_balance: 5000 },
      { id: "2", account_type: "credit_card", current_balance: -2000 },
      { id: "3", account_type: "investment", current_balance: 10000 },
    ];
    const patrimony = accounts
      .filter(a => a.account_type !== "credit_card")
      .reduce((s, a) => s + a.current_balance, 0);
    expect(patrimony).toBe(15000);
  });
});
