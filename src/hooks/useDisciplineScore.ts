import { useMemo } from "react";
import { useBudgetAnalysis } from "./useBudgetAnalysis";
import { useMonthlyPlan } from "./useMonthlyPlan";
import { useTransactions } from "./useTransactions";
import { useDashboardStats } from "./useDashboardStats";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface DisciplineScoreResult {
  score: number;
  tips: string[];
  isLoading: boolean;
}

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

  const { score, tips } = useMemo(() => {
    if (!budgetAnalysis || !stats) return { score: 0, tips: [] as string[] };

    const tips: string[] = [];
    let total = 0;

    // 40 pts: % of categories within budget
    const totalCategories = budgetAnalysis.items.length;
    const withinBudget = budgetAnalysis.items.filter(i => i.status !== "over").length;
    const budgetPct = totalCategories > 0 ? withinBudget / totalCategories : 1;
    total += Math.round(budgetPct * 40);
    if (total < 40 && totalCategories > 0) {
      const over = totalCategories - withinBudget;
      tips.push(`${over} categoria${over > 1 ? "s" : ""} estourou o orçamento`);
    }

    // 30 pts: investment >= target (using type === "investment")
    const investmentTarget = plan?.investment_target ?? 0;
    const totalInvested = (monthTx || [])
      .filter(t => t.type === "investment")
      .reduce((s, t) => s + Number(t.amount), 0);
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
    const actualIncome = stats.monthlyIncome ?? 0;
    if (incomeTarget > 0 && actualIncome >= incomeTarget * 0.9) {
      total += 20;
    } else if (incomeTarget > 0) {
      tips.push("Receita abaixo de 90% da meta");
    } else {
      total += 10;
      tips.push("Defina uma meta de receita");
    }

    // 10 pts: all transactions categorized
    const uncategorized = (monthTx || []).filter(
      t => !t.category_id && t.type !== "transfer" && !t.is_ignored
    ).length;
    if (uncategorized === 0) {
      total += 10;
    } else {
      tips.push(`${uncategorized} transação${uncategorized > 1 ? "ões" : ""} sem categoria`);
    }

    return { score: Math.min(100, Math.max(0, total)), tips };
  }, [budgetAnalysis, plan, stats, monthTx]);

  return { score, tips, isLoading };
}
