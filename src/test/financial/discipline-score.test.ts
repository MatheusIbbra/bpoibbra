import { describe, it, expect } from "vitest";

/**
 * Pure discipline score calculation extracted from useDisciplineScore.ts.
 * Tests the core algorithm without React hooks or Supabase.
 */

interface BudgetItem {
  status: "under" | "on_track" | "over";
}

interface BudgetAnalysis {
  items: BudgetItem[];
  totalActual: number;
  overBudgetCount: number;
}

interface Plan {
  income_target: number;
  investment_target: number;
}

interface Transaction {
  type: string;
  amount: number;
  category_id: string | null;
  is_ignored: boolean;
}

function calculateDisciplineScore(
  budgetAnalysis: BudgetAnalysis | null,
  plan: Plan | null,
  actualIncome: number,
  transactions: Transaction[]
): { score: number; tips: string[] } {
  if (!budgetAnalysis) return { score: 0, tips: [] };

  const tips: string[] = [];
  let total = 0;

  // 40 pts: % of categories within budget
  const totalCategories = budgetAnalysis.items.length;
  const withinBudget = budgetAnalysis.items.filter(
    (i) => i.status !== "over"
  ).length;
  const budgetPct = totalCategories > 0 ? withinBudget / totalCategories : 1;
  total += Math.round(budgetPct * 40);
  if (total < 40 && totalCategories > 0) {
    const over = totalCategories - withinBudget;
    tips.push(
      `${over} categoria${over > 1 ? "s" : ""} estourou o orçamento`
    );
  }

  // 30 pts: investment >= target (type === "investment")
  const investmentTarget = plan?.investment_target ?? 0;
  const totalInvested = transactions
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + t.amount, 0);
  if (investmentTarget > 0 && totalInvested >= investmentTarget) {
    total += 30;
  } else if (investmentTarget > 0) {
    tips.push("Investimento abaixo da meta mensal");
  } else {
    total += 15;
    tips.push("Defina uma meta de investimento");
  }

  // 20 pts: actual income >= 90% of target
  const incomeTarget = plan?.income_target ?? 0;
  if (incomeTarget > 0 && actualIncome >= incomeTarget * 0.9) {
    total += 20;
  } else if (incomeTarget > 0) {
    tips.push("Receita abaixo de 90% da meta");
  } else {
    total += 10;
    tips.push("Defina uma meta de receita");
  }

  // 10 pts: all transactions categorized
  const uncategorized = transactions.filter(
    (t) => !t.category_id && t.type !== "transfer" && !t.is_ignored
  ).length;
  if (uncategorized === 0) {
    total += 10;
  } else {
    tips.push(
      `${uncategorized} transação${uncategorized > 1 ? "ões" : ""} sem categoria`
    );
  }

  return { score: Math.min(100, Math.max(0, total)), tips };
}

describe("Discipline Score", () => {
  it("score 100: tudo perfeito — orçamento ok, investimento atingido, receita atingida, tudo categorizado", () => {
    const analysis: BudgetAnalysis = {
      items: [
        { status: "under" },
        { status: "on_track" },
        { status: "under" },
      ],
      totalActual: 5000,
      overBudgetCount: 0,
    };
    const plan: Plan = { income_target: 10000, investment_target: 2000 };
    const transactions: Transaction[] = [
      { type: "investment", amount: 2500, category_id: "cat1", is_ignored: false },
      { type: "expense", amount: 3000, category_id: "cat2", is_ignored: false },
      { type: "income", amount: 10000, category_id: "cat3", is_ignored: false },
    ];

    const result = calculateDisciplineScore(analysis, plan, 10000, transactions);

    expect(result.score).toBe(100);
    expect(result.tips).toHaveLength(0);
  });

  it("score 0: sem budgetAnalysis", () => {
    const result = calculateDisciplineScore(null, null, 0, []);

    expect(result.score).toBe(0);
    expect(result.tips).toHaveLength(0);
  });

  it("score parcial: 2 de 4 categorias ok, sem meta de investimento definida", () => {
    const analysis: BudgetAnalysis = {
      items: [
        { status: "under" },
        { status: "under" },
        { status: "over" },
        { status: "over" },
      ],
      totalActual: 8000,
      overBudgetCount: 2,
    };
    const plan: Plan = { income_target: 10000, investment_target: 0 };
    const transactions: Transaction[] = [
      { type: "expense", amount: 5000, category_id: "cat1", is_ignored: false },
      { type: "expense", amount: 3000, category_id: null, is_ignored: false },
    ];

    const result = calculateDisciplineScore(analysis, plan, 9500, transactions);

    // Budget: 2/4 = 50% → round(0.5 * 40) = 20
    // Investment: no target → 15 pts + tip
    // Income: 9500 >= 9000 → 20 pts
    // Categorized: 1 uncategorized expense → 0 pts + tip
    expect(result.score).toBe(20 + 15 + 20);
    expect(result.tips).toContain("2 categorias estourou o orçamento");
    expect(result.tips).toContain("Defina uma meta de investimento");
    expect(result.tips).toContain("1 transação sem categoria");
  });

  it("sem plano: investimento dá 15, receita dá 10 (parciais)", () => {
    const analysis: BudgetAnalysis = {
      items: [{ status: "under" }],
      totalActual: 1000,
      overBudgetCount: 0,
    };

    const result = calculateDisciplineScore(analysis, null, 0, [
      { type: "expense", amount: 1000, category_id: "c1", is_ignored: false },
    ]);

    // Budget: 1/1 = 100% → 40 pts
    // Investment: no target → 15 pts
    // Income: no target → 10 pts
    // Categorized: all categorized → 10 pts
    expect(result.score).toBe(40 + 15 + 10 + 10);
  });
});
