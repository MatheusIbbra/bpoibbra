import { describe, it, expect } from "vitest";

/**
 * Pure discipline score calculation extracted from useDisciplineScore.ts.
 * Weights: Investment=30, Income=25, Expense control=20, Categorization=15, Patrimony=10
 */

interface BudgetItem {
  status: "under" | "on_track" | "over";
}

interface BudgetAnalysis {
  items: BudgetItem[];
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
  actualExpenses: number,
  transactions: Transaction[]
): { score: number; tips: string[] } {
  if (!budgetAnalysis) return { score: 0, tips: [] };

  const tips: string[] = [];
  let total = 0;

  // 1. Investment (30 pts)
  const investTarget = plan?.investment_target ?? 0;
  const totalInvested = transactions
    .filter(t => t.type === "investment" && !t.is_ignored)
    .reduce((s, t) => s + t.amount, 0);
  const investPct = investTarget > 0 ? Math.min(totalInvested / investTarget, 1) : (totalInvested > 0 ? 1 : 0);
  const investPts = investTarget > 0
    ? Math.round(investPct * 30)
    : totalInvested > 0 ? 22 : 15;
  total += investPts;
  if (investTarget === 0) tips.push("Defina uma meta de investimento mensal");
  else if (totalInvested < investTarget) tips.push(`Faltam para atingir a meta de aporte`);

  // 2. Income vs target (25 pts)
  const incomeTarget = plan?.income_target ?? 0;
  let incomePts = 0;
  if (incomeTarget > 0) {
    incomePts = Math.round(Math.min(actualIncome / incomeTarget, 1) * 25);
  } else {
    incomePts = actualIncome > 0 ? 15 : 8;
  }
  total += incomePts;
  if (incomeTarget === 0) tips.push("Defina uma meta de receita mensal");
  else if (actualIncome < incomeTarget * 0.9) tips.push("Receita abaixo da meta");

  // 3. Expense control (20 pts)
  const totalCategories = budgetAnalysis.items.length;
  const withinBudget = budgetAnalysis.items.filter(i => i.status !== "over").length;
  const budgetAdherePct = totalCategories > 0 ? withinBudget / totalCategories : 1;
  const expensePts = Math.round(budgetAdherePct * 20);
  total += expensePts;
  const overCount = totalCategories - withinBudget;
  if (overCount > 0) tips.push(`${overCount} categorias estouraram o orçamento`);

  // 4. Categorization (15 pts)
  const allTx = transactions.filter(t => t.type !== "transfer" && !t.is_ignored);
  const uncategorized = allTx.filter(t => !t.category_id && t.type !== "investment" && t.type !== "redemption").length;
  const catPts = allTx.length > 0
    ? Math.round(((allTx.length - uncategorized) / allTx.length) * 15)
    : 15;
  total += catPts;
  if (uncategorized > 0) tips.push(`${uncategorized} transações sem categoria`);

  // 5. Patrimony health (10 pts) — savings rate, target 20%
  const savingsRate = actualIncome > 0 ? (actualIncome - actualExpenses) / actualIncome : 0;
  const patriPts = Math.round(Math.max(0, Math.min(savingsRate / 0.20, 1)) * 10);
  total += patriPts;
  if (savingsRate < 0.05 && actualIncome > 0) tips.push("Taxa de poupança abaixo de 5%");

  return { score: Math.min(100, Math.max(0, total)), tips };
}

describe("Discipline Score (new weights)", () => {
  it("score 100: tudo perfeito", () => {
    const analysis: BudgetAnalysis = {
      items: [{ status: "under" }, { status: "on_track" }, { status: "under" }],
    };
    const plan: Plan = { income_target: 10000, investment_target: 2000 };
    const transactions: Transaction[] = [
      { type: "investment", amount: 2000, category_id: "c1", is_ignored: false },
      { type: "expense", amount: 2000, category_id: "c2", is_ignored: false },
      { type: "income", amount: 10000, category_id: "c3", is_ignored: false },
    ];
    const result = calculateDisciplineScore(analysis, plan, 10000, 2000, transactions);
    // invest=30, income=25, expense=20, cat=15, patrimony: (10k-2k)/10k=80% → min(0.8/0.2,1)=1 → 10
    expect(result.score).toBe(100);
    expect(result.tips).toHaveLength(0);
  });

  it("score 0: sem budgetAnalysis", () => {
    const result = calculateDisciplineScore(null, null, 0, 0, []);
    expect(result.score).toBe(0);
  });

  it("sem plano: investimento=15, receita=8 (nenhuma), despesas=20, cat=15, patrimony=0", () => {
    const analysis: BudgetAnalysis = { items: [{ status: "under" }] };
    const result = calculateDisciplineScore(analysis, null, 0, 0, [
      { type: "expense", amount: 1000, category_id: "c1", is_ignored: false },
    ]);
    // invest=15 (no target, no invest), income=8 (no target, no income), expense=20, cat=15, patrimony=0
    expect(result.score).toBe(15 + 8 + 20 + 15 + 0);
  });

  it("investimento parcial: 50% da meta → 15 pts", () => {
    const analysis: BudgetAnalysis = { items: [{ status: "under" }] };
    const plan: Plan = { income_target: 0, investment_target: 2000 };
    const transactions: Transaction[] = [
      { type: "investment", amount: 1000, category_id: null, is_ignored: false },
    ];
    const result = calculateDisciplineScore(analysis, plan, 0, 0, transactions);
    // invest: 1000/2000=50% → round(0.5*30)=15
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.tips).toContain("Faltam para atingir a meta de aporte");
  });
});
