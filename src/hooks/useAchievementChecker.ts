import { useEffect, useRef } from "react";
import { useAchievements, useUnlockAchievement } from "./useAchievements";
import { useBudgets } from "./useBudgets";
import { useBudgetAnalysis } from "./useBudgetAnalysis";
import { useMonthlyPlan } from "./useMonthlyPlan";
import { useDashboardStats } from "./useDashboardStats";
import { useTransactions } from "./useTransactions";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

/**
 * Runs achievement checks whenever relevant data changes.
 * Should be mounted once in the app (e.g. in a layout or dashboard).
 */
export function useAchievementChecker(selectedMonth: Date) {
  const month = selectedMonth.getMonth() + 1;
  const year = selectedMonth.getFullYear();
  const checked = useRef<string>("");

  const { data: achievements } = useAchievements();
  const unlock = useUnlockAchievement();
  const { data: budgets } = useBudgets(month, year);
  const { data: analysis } = useBudgetAnalysis(month, year);
  const { data: plan } = useMonthlyPlan(month, year);
  const { data: stats } = useDashboardStats(selectedMonth);

  // Transactions for the current month — used for investidor badges
  const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const endDateStr = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
  const { data: monthTx } = useTransactions({ startDate, endDate: endDateStr });

  // Budget analysis for 3 prior months — used for streak_3
  const m1 = subMonths(selectedMonth, 1);
  const m2 = subMonths(selectedMonth, 2);
  const m3 = subMonths(selectedMonth, 3);
  const { data: analysis1 } = useBudgetAnalysis(m1.getMonth() + 1, m1.getFullYear());
  const { data: analysis2 } = useBudgetAnalysis(m2.getMonth() + 1, m2.getFullYear());
  const { data: analysis3 } = useBudgetAnalysis(m3.getMonth() + 1, m3.getFullYear());

  const unlockedKeys = new Set(achievements?.map((a) => a.achievement_key) || []);

  useEffect(() => {
    const key = `${month}-${year}-${budgets?.length}-${analysis?.totalActual}-${plan?.id}-${stats?.monthlyIncome}-${monthTx?.length}-${analysis1?.totalActual}-${analysis2?.totalActual}-${analysis3?.totalActual}`;
    if (checked.current === key) return;
    checked.current = key;

    if (!budgets || !achievements) return;

    // primeiro_orcamento
    if (!unlockedKeys.has("primeiro_orcamento") && budgets.length > 0) {
      unlock.mutate("primeiro_orcamento");
    }

    // mes_no_verde — all categories within budget
    if (!unlockedKeys.has("mes_no_verde") && analysis && analysis.items.length > 0) {
      const allGood = analysis.items.every((i) => i.status !== "over");
      if (allGood && analysis.totalActual > 0) {
        unlock.mutate("mes_no_verde");
      }
    }

    // investidor_10 / investidor_20 — using ACTUAL invested amount (type === "investment")
    if (stats && stats.monthlyIncome > 0 && monthTx) {
      const totalInvested = monthTx
        .filter(t => t.type === "investment")
        .reduce((s, t) => s + Number(t.amount), 0);
      const investmentRate = (totalInvested / stats.monthlyIncome) * 100;
      if (!unlockedKeys.has("investidor_10") && investmentRate >= 10) {
        unlock.mutate("investidor_10");
      }
      if (!unlockedKeys.has("investidor_20") && investmentRate >= 20) {
        unlock.mutate("investidor_20");
      }
    }

    // streak_3 — 3 consecutive months all within budget
    if (!unlockedKeys.has("streak_3") && analysis1 && analysis2 && analysis3) {
      const allThreeGood = [analysis1, analysis2, analysis3].every(
        a => a.items.length > 0 && a.overBudgetCount === 0 && a.totalActual > 0
      );
      if (allThreeGood) {
        unlock.mutate("streak_3");
      }
    }

    // base_zero
    if (!unlockedKeys.has("base_zero") && plan && budgets.length > 0) {
      const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
      const freeBalance = plan.income_target - plan.investment_target - totalBudget;
      if (Math.abs(freeBalance) < 0.01 && plan.income_target > 0) {
        unlock.mutate("base_zero");
      }
    }
  }, [budgets, analysis, plan, stats, achievements, month, year, monthTx, analysis1, analysis2, analysis3]);
}
