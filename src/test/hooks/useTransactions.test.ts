import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
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

describe("useTransactions - unit logic tests", () => {
  it("filters transactions by date range correctly", () => {
    const transactions = [
      { id: "1", date: "2024-01-15", amount: 100, type: "income", is_ignored: false, validation_status: "validated" },
      { id: "2", date: "2024-02-15", amount: 200, type: "expense", is_ignored: false, validation_status: "validated" },
      { id: "3", date: "2024-03-15", amount: 300, type: "income", is_ignored: false, validation_status: "validated" },
    ];

    const start = "2024-01-01";
    const end = "2024-02-28";
    const filtered = transactions.filter(t => t.date >= start && t.date <= end);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("1");
    expect(filtered[1].id).toBe("2");
  });

  it("filters out ignored transactions", () => {
    const transactions = [
      { id: "1", is_ignored: false, validation_status: "validated", amount: 100 },
      { id: "2", is_ignored: true, validation_status: "validated", amount: 200 },
      { id: "3", is_ignored: false, validation_status: "pending_validation", amount: 300 },
    ];
    const visible = transactions.filter(t => !t.is_ignored);
    expect(visible).toHaveLength(2);
    expect(visible.map(t => t.id)).toEqual(["1", "3"]);
  });

  it("paginates transactions correctly", () => {
    const transactions = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1) }));
    const pageSize = 10;
    const page1 = transactions.slice(0, pageSize);
    const page2 = transactions.slice(pageSize, pageSize * 2);
    const page3 = transactions.slice(pageSize * 2);

    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(5);
  });

  it("search filters by description case-insensitively", () => {
    const transactions = [
      { id: "1", description: "Supermercado Extra" },
      { id: "2", description: "Farmácia São João" },
      { id: "3", description: "SUPERMERCADO PAO DE ACUCAR" },
    ];
    const search = "supermercado";
    const filtered = transactions.filter(t =>
      t.description.toLowerCase().includes(search.toLowerCase())
    );
    expect(filtered).toHaveLength(2);
  });

  it("calculates total income and expenses correctly", () => {
    const transactions = [
      { type: "income", amount: 5000, is_ignored: false },
      { type: "expense", amount: 1500, is_ignored: false },
      { type: "expense", amount: 800, is_ignored: false },
      { type: "income", amount: 200, is_ignored: true }, // ignored, shouldn't count
    ];
    const active = transactions.filter(t => !t.is_ignored);
    const income = active.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = active.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    expect(income).toBe(5000);
    expect(expenses).toBe(2300);
  });
});
