import { useMemo } from "react";
import { useBudgetAnalysis } from "./useBudgetAnalysis";
import { useMonthlyPlan } from "./useMonthlyPlan";
import { useTransactions } from "./useTransactions";
import { useDashboardStats } from "./useDashboardStats";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface DisciplineIndicator {
  label: string;
  current: number;
  target: number;
  points: number;
  maxPoints: number;
  pct: number; // 0-100
  status: "ok" | "warning" | "critical";
  detail: string; // human-readable detail line
}

export interface DisciplineScoreResult {
  score: number;
  indicators: DisciplineIndicator[];
  tips: string[];
  isLoading: boolean;
}

/**
 * Weighted discipline score (total 100 pts):
 *  • Investment monthly:    30 pts
 *  • Income vs target:      25 pts
 *  • Expense control:       20 pts  (budget adherence)
 *  • Categorization:        15 pts
 *  • Patrimony health:      10 pts  (savings rate)
 */
export function useDisciplineScore(selectedMonth: Date): DisciplineScoreResult {
  const month = selectedMonth.getMonth() + 1;
  const year = selectedMonth.getFullYear();

  const { data: budgetAnalysis, isLoading: budgetLoading } = useBudgetAnalysis(month, year);
  const { data: plan, isLoading: planLoading } = useMonthlyPlan(month, year);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedMonth);

  const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
  const { data: monthTx, isLoading: txLoading } = useTransactions({ startDate, endDate });

  const isLoading = budgetLoading || planLoading || statsLoading || txLoading;

  const result = useMemo((): { score: number; indicators: DisciplineIndicator[]; tips: string[] } => {
    if (!budgetAnalysis || !stats) return { score: 0, indicators: [], tips: [] };

    const fmt = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

    const indicators: DisciplineIndicator[] = [];
    const tips: string[] = [];
    let totalScore = 0;

    // ── 1. Investment (30 pts) — MORE is BETTER, never penalize above target ──
    const investTarget = plan?.investment_target ?? 0;
    const totalInvested = (monthTx || [])
      .filter(t => t.type === "investment" && !t.is_ignored)
      .reduce((s, t) => s + Number(t.amount), 0);

    // Ratio capped at 1 for score (100% = full points), but UI pct can exceed 100
    const investRatio = investTarget > 0 ? totalInvested / investTarget : (totalInvested > 0 ? 1 : 0);
    const investPct   = investTarget > 0 ? Math.round(investRatio * 100) : (totalInvested > 0 ? 100 : 0);
    const investPts   = investTarget > 0
      ? Math.round(Math.min(investRatio, 1) * 30)
      : totalInvested > 0 ? 22 : 15;

    totalScore += investPts;
    const investStatus: DisciplineIndicator["status"] =
      investPts >= 28 ? "ok" : investPts >= 15 ? "warning" : "critical";
    indicators.push({
      label: "Investimento mensal",
      current: totalInvested,
      target: investTarget,
      points: investPts,
      maxPoints: 30,
      pct: Math.min(investPct, 100), // bar capped at 100%
      status: investStatus,
      detail: investTarget > 0
        ? investRatio >= 1
          ? `${fmt(totalInvested)} ✓ Meta atingida! (${investPct}%)`
          : `${fmt(totalInvested)} de ${fmt(investTarget)} (${investPct}%)`
        : totalInvested > 0
          ? `${fmt(totalInvested)} investido (sem meta definida)`
          : "Nenhum aporte no mês",
    });
    if (investTarget === 0) tips.push("Defina uma meta de investimento mensal");
    else if (totalInvested < investTarget) tips.push(`Faltam ${fmt(investTarget - totalInvested)} para atingir a meta de aporte`);

    // ── 2. Income vs target (25 pts) — MORE is BETTER, never penalize above ──
    const incomeTarget = plan?.income_target ?? 0;
    const actualIncome = stats.monthlyIncome ?? 0;
    const incomeRatio  = incomeTarget > 0 ? actualIncome / incomeTarget : (actualIncome > 0 ? 1 : 0);
    const incomePct    = incomeTarget > 0 ? Math.round(incomeRatio * 100) : (actualIncome > 0 ? 100 : 0);
    let incomePts      = 0;
    if (incomeTarget > 0) {
      incomePts = Math.round(Math.min(incomeRatio, 1) * 25);
    } else {
      incomePts = actualIncome > 0 ? 15 : 8;
    }
    totalScore += incomePts;
    const incomeStatus: DisciplineIndicator["status"] =
      incomePts >= 23 ? "ok" : incomePts >= 13 ? "warning" : "critical";
    indicators.push({
      label: "Receita do mês",
      current: actualIncome,
      target: incomeTarget,
      points: incomePts,
      maxPoints: 25,
      pct: Math.min(incomePct, 100),
      status: incomeStatus,
      detail: incomeTarget > 0
        ? incomeRatio >= 1
          ? `${fmt(actualIncome)} ✓ Meta atingida! (${incomePct}%)`
          : `${fmt(actualIncome)} de ${fmt(incomeTarget)} (${incomePct}%)`
        : actualIncome > 0
          ? `${fmt(actualIncome)} recebido (sem meta definida)`
          : "Nenhuma receita registrada",
    });
    if (incomeTarget === 0) tips.push("Defina uma meta de receita mensal");
    else if (actualIncome < incomeTarget * 0.9) tips.push(`Receita ${Math.round((1 - Math.min(incomeRatio, 1)) * 100)}% abaixo da meta`);

    // ── 3. Expense control / budget adherence (20 pts) ───────────────────
    const totalCategories = budgetAnalysis.items.length;
    const withinBudget = budgetAnalysis.items.filter(i => i.status !== "over").length;
    const budgetAdherePct = totalCategories > 0 ? withinBudget / totalCategories : 1;
    const expensePts = Math.round(budgetAdherePct * 20);
    totalScore += expensePts;
    const overCount = totalCategories - withinBudget;
    const expenseStatus: DisciplineIndicator["status"] =
      overCount === 0 ? "ok" : overCount <= 1 ? "warning" : "critical";
    indicators.push({
      label: "Controle de despesas",
      current: withinBudget,
      target: totalCategories,
      points: expensePts,
      maxPoints: 20,
      pct: Math.round(budgetAdherePct * 100),
      status: expenseStatus,
      detail: totalCategories > 0
        ? `${withinBudget} de ${totalCategories} categorias dentro do orçamento`
        : "Nenhum orçamento configurado",
    });
    if (overCount > 0) tips.push(`${overCount} categori${overCount > 1 ? "as estouraram" : "a estourou"} o orçamento`);

    // ── 4. Categorization (15 pts) ────────────────────────────────────────
    const allTx = (monthTx || []).filter(t => t.type !== "transfer" && !t.is_ignored);
    const uncategorized = allTx.filter(t => !t.category_id && t.type !== "investment" && t.type !== "redemption").length;
    const catPts = allTx.length > 0
      ? Math.round(((allTx.length - uncategorized) / allTx.length) * 15)
      : 15;
    totalScore += catPts;
    const catStatus: DisciplineIndicator["status"] =
      uncategorized === 0 ? "ok" : uncategorized <= 2 ? "warning" : "critical";
    indicators.push({
      label: "Transações categorizadas",
      current: allTx.length - uncategorized,
      target: allTx.length,
      points: catPts,
      maxPoints: 15,
      pct: allTx.length > 0 ? Math.round(((allTx.length - uncategorized) / allTx.length) * 100) : 100,
      status: catStatus,
      detail: uncategorized === 0
        ? "Todas as transações categorizadas"
        : `${uncategorized} transaç${uncategorized > 1 ? "ões" : "ão"} sem categoria`,
    });
    if (uncategorized > 0) tips.push(`${uncategorized} transaç${uncategorized > 1 ? "ões" : "ão"} sem categoria`);

    // ── 5. Patrimony health / savings rate (10 pts) ───────────────────────
    const expenses = stats.monthlyExpenses ?? 0;
    const savingsRate = actualIncome > 0 ? (actualIncome - expenses) / actualIncome : 0;
    // Target: 20%+ savings rate = full points
    const patriPct = Math.max(0, Math.min(savingsRate / 0.20, 1));
    const patriPts = Math.round(patriPct * 10);
    totalScore += patriPts;
    const patriStatus: DisciplineIndicator["status"] =
      savingsRate >= 0.20 ? "ok" : savingsRate >= 0.05 ? "warning" : "critical";
    indicators.push({
      label: "Saúde patrimonial",
      current: Math.max(savingsRate * 100, 0),
      target: 20,
      points: patriPts,
      maxPoints: 10,
      pct: Math.round(Math.max(0, Math.min(savingsRate / 0.20, 1)) * 100),
      status: patriStatus,
      detail: actualIncome > 0
        ? `Taxa de poupança: ${Math.round(savingsRate * 100)}% (meta: 20%)`
        : "Sem receita para calcular",
    });
    if (savingsRate < 0.05 && actualIncome > 0) tips.push("Taxa de poupança abaixo de 5%");

    return { score: Math.min(100, Math.max(0, totalScore)), indicators, tips };
  }, [budgetAnalysis, plan, stats, monthTx]);

  return { ...result, isLoading };
}
