import { describe, it, expect } from "vitest";

/**
 * Pure achievement check logic extracted from useAchievementChecker.ts.
 * Tests the unlock conditions without React or Supabase dependencies.
 */

interface Budget {
  amount: number;
}

interface BudgetAnalysis {
  items: { status: string }[];
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
}

function checkPrimeiroOrcamento(budgets: Budget[]): boolean {
  return budgets.length > 0;
}

function checkInvestidor10(
  monthlyIncome: number,
  transactions: Transaction[]
): boolean {
  if (monthlyIncome <= 0) return false;
  const totalInvested = transactions
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + Number(t.amount), 0);
  const investmentRate = (totalInvested / monthlyIncome) * 100;
  return investmentRate >= 10;
}

function checkInvestidor20(
  monthlyIncome: number,
  transactions: Transaction[]
): boolean {
  if (monthlyIncome <= 0) return false;
  const totalInvested = transactions
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + Number(t.amount), 0);
  return (totalInvested / monthlyIncome) * 100 >= 20;
}

function checkBaseZero(plan: Plan | null, budgets: Budget[]): boolean {
  if (!plan || budgets.length === 0) return false;
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const freeBalance = plan.income_target - plan.investment_target - totalBudget;
  return Math.abs(freeBalance) < 0.01 && plan.income_target > 0;
}

function checkStreak3(
  analysis1: BudgetAnalysis | null,
  analysis2: BudgetAnalysis | null,
  analysis3: BudgetAnalysis | null
): boolean {
  if (!analysis1 || !analysis2 || !analysis3) return false;
  return [analysis1, analysis2, analysis3].every(
    (a) => a.items.length > 0 && a.overBudgetCount === 0 && a.totalActual > 0
  );
}

describe("Achievement Checker — primeiro_orcamento", () => {
  it("desbloqueia quando budgets.length > 0", () => {
    expect(checkPrimeiroOrcamento([{ amount: 500 }])).toBe(true);
  });

  it("não desbloqueia quando budgets está vazio", () => {
    expect(checkPrimeiroOrcamento([])).toBe(false);
  });
});

describe("Achievement Checker — investidor_10", () => {
  it("desbloqueia quando totalInvested / income >= 10%", () => {
    const tx: Transaction[] = [
      { type: "investment", amount: 1000 },
      { type: "investment", amount: 500 },
    ];
    // 1500 / 10000 = 15%
    expect(checkInvestidor10(10000, tx)).toBe(true);
  });

  it("não desbloqueia quando investimento < 10%", () => {
    const tx: Transaction[] = [{ type: "investment", amount: 500 }];
    // 500 / 10000 = 5%
    expect(checkInvestidor10(10000, tx)).toBe(false);
  });

  it("usa tipo 'investment', não a meta do plano", () => {
    // Apenas transações tipo "expense" com nome de investimento → NÃO conta
    const tx: Transaction[] = [{ type: "expense", amount: 2000 }];
    expect(checkInvestidor10(10000, tx)).toBe(false);
  });

  it("exatamente 10% desbloqueia", () => {
    const tx: Transaction[] = [{ type: "investment", amount: 1000 }];
    expect(checkInvestidor10(10000, tx)).toBe(true);
  });

  it("não desbloqueia se income é zero", () => {
    const tx: Transaction[] = [{ type: "investment", amount: 1000 }];
    expect(checkInvestidor10(0, tx)).toBe(false);
  });
});

describe("Achievement Checker — base_zero", () => {
  it("desbloqueia quando income - investimento - budget ≈ 0", () => {
    const plan: Plan = { income_target: 10000, investment_target: 2000 };
    const budgets: Budget[] = [{ amount: 5000 }, { amount: 3000 }];
    // 10000 - 2000 - 8000 = 0
    expect(checkBaseZero(plan, budgets)).toBe(true);
  });

  it("não desbloqueia quando há saldo livre", () => {
    const plan: Plan = { income_target: 10000, investment_target: 2000 };
    const budgets: Budget[] = [{ amount: 5000 }];
    // 10000 - 2000 - 5000 = 3000
    expect(checkBaseZero(plan, budgets)).toBe(false);
  });

  it("não desbloqueia sem plano", () => {
    expect(checkBaseZero(null, [{ amount: 1000 }])).toBe(false);
  });

  it("não desbloqueia se income_target é 0", () => {
    const plan: Plan = { income_target: 0, investment_target: 0 };
    expect(checkBaseZero(plan, [])).toBe(false);
  });
});

describe("Achievement Checker — streak_3", () => {
  const goodMonth: BudgetAnalysis = {
    items: [{ status: "under" }, { status: "on_track" }],
    totalActual: 5000,
    overBudgetCount: 0,
  };

  const badMonth: BudgetAnalysis = {
    items: [{ status: "over" }],
    totalActual: 3000,
    overBudgetCount: 1,
  };

  it("desbloqueia com 3 meses consecutivos dentro do orçamento", () => {
    expect(checkStreak3(goodMonth, goodMonth, goodMonth)).toBe(true);
  });

  it("não desbloqueia se um mês estourou", () => {
    expect(checkStreak3(goodMonth, badMonth, goodMonth)).toBe(false);
  });

  it("não desbloqueia se um mês é null", () => {
    expect(checkStreak3(goodMonth, null, goodMonth)).toBe(false);
  });

  it("não desbloqueia se um mês tem totalActual === 0 (sem dados)", () => {
    const emptyMonth: BudgetAnalysis = {
      items: [{ status: "under" }],
      totalActual: 0,
      overBudgetCount: 0,
    };
    expect(checkStreak3(goodMonth, goodMonth, emptyMonth)).toBe(false);
  });
});
