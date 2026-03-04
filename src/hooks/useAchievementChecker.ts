import { useEffect, useRef } from "react";
import { useAchievements, useUnlockAchievement } from "./useAchievements";
import { useBudgets } from "./useBudgets";
import { useBudgetAnalysis } from "./useBudgetAnalysis";
import { useMonthlyPlan } from "./useMonthlyPlan";
import { useDashboardStats } from "./useDashboardStats";

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

  const unlockedKeys = new Set(achievements?.map((a) => a.achievement_key) || []);

  useEffect(() => {
    const key = `${month}-${year}-${budgets?.length}-${analysis?.totalActual}-${plan?.id}-${stats?.monthlyIncome}`;
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

    // investidor_10 / investidor_20
    if (stats && stats.monthlyIncome > 0 && plan) {
      const investmentRate = (plan.investment_target / stats.monthlyIncome) * 100;
      if (!unlockedKeys.has("investidor_10") && investmentRate >= 10) {
        unlock.mutate("investidor_10");
      }
      if (!unlockedKeys.has("investidor_20") && investmentRate >= 20) {
        unlock.mutate("investidor_20");
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
  }, [budgets, analysis, plan, stats, achievements, month, year]);
}
