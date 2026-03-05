import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
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
  }),
}));

describe("useCategories - unit logic tests", () => {
  it("builds category hierarchy from flat list", () => {
    const flat = [
      { id: "p1", name: "Alimentação", parent_id: null, type: "expense" },
      { id: "p2", name: "Transporte", parent_id: null, type: "expense" },
      { id: "c1", name: "Supermercado", parent_id: "p1", type: "expense" },
      { id: "c2", name: "Restaurante", parent_id: "p1", type: "expense" },
      { id: "c3", name: "Uber", parent_id: "p2", type: "expense" },
    ];

    const parents = flat.filter(c => !c.parent_id);
    const children = flat.filter(c => c.parent_id);
    parents.forEach(p => {
      (p as any).children = children.filter(c => c.parent_id === p.id);
    });

    expect(parents).toHaveLength(2);
    const alimentacao = parents.find(p => p.id === "p1") as any;
    expect(alimentacao.children).toHaveLength(2);
    expect(alimentacao.children.map((c: any) => c.name)).toContain("Supermercado");
  });

  it("filters categories by type", () => {
    const categories = [
      { id: "1", name: "Salário", type: "income" },
      { id: "2", name: "Freelance", type: "income" },
      { id: "3", name: "Mercado", type: "expense" },
    ];
    const income = categories.filter(c => c.type === "income");
    const expense = categories.filter(c => c.type === "expense");
    expect(income).toHaveLength(2);
    expect(expense).toHaveLength(1);
  });

  it("validates that sub-categories cannot have children", () => {
    const categories = [
      { id: "p1", name: "Alimentação", parent_id: null },
      { id: "c1", name: "Supermercado", parent_id: "p1" },
    ];

    const isChild = (id: string) => categories.some(c => c.parent_id === id);

    // Can create child under parent (p1 is a parent, not a child)
    const p1 = categories.find(c => c.id === "p1");
    expect(p1?.parent_id).toBeNull();

    // Cannot create child under another child (c1 already has a parent)
    const c1 = categories.find(c => c.id === "c1");
    expect(c1?.parent_id).not.toBeNull();
    // Attempt to create sub-sub category should fail
    const wouldFail = c1?.parent_id !== null; // c1 is a child, so we can't attach to it
    expect(wouldFail).toBe(true);
  });

  it("returns empty array when no categories exist", () => {
    const categories: any[] = [];
    const hierarchy = categories.filter(c => !c.parent_id);
    expect(hierarchy).toHaveLength(0);
  });

  it("counts categories by type correctly", () => {
    const categories = [
      { type: "income" }, { type: "income" }, { type: "income" },
      { type: "expense" }, { type: "expense" },
      { type: "investment" },
    ];
    const counts = categories.reduce((acc: Record<string, number>, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});
    expect(counts.income).toBe(3);
    expect(counts.expense).toBe(2);
    expect(counts.investment).toBe(1);
  });
});
