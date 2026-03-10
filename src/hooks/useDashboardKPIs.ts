import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import { useAccounts } from "@/hooks/useAccounts";
import { useBudgets } from "@/hooks/useBudgets";
import { useTransactions } from "@/hooks/useTransactions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { usePaginatedTransactions } from "@/hooks/usePaginatedTransactions";

export function useDashboardKPIs(selectedMonth: Date) {
  const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  const { data: stats, error, isLoading: statsLoading } = useDashboardStats(selectedMonth);
  const { data: accounts } = useAccounts();
  const { data: budgets } = useBudgets(selectedMonth.getMonth() + 1, selectedMonth.getFullYear());
  const { data: expenseTransactions } = useTransactions({ type: "expense", startDate, endDate });
  const { data: paginatedMonthData } = usePaginatedTransactions({ startDate, endDate, page: 0 });

  const monthTransactions = paginatedMonthData?.data || [];

  const income = stats?.monthlyIncome ?? 0;
  const expenses = stats?.monthlyExpenses ?? 0;
  const savings = stats?.monthlySavings ?? 0;
  const totalBalance = stats?.totalBalance ?? 0;
  const evolutionPct = income > 0 ? (savings / income) * 100 : 0;

  // Accounts
  const financialAccounts = useMemo(
    () => accounts?.filter(
      a => a.account_type !== "credit_card" && a.account_type !== "investment" && a.status === "active"
    ) ?? [],
    [accounts]
  );

  const investmentAccounts = useMemo(
    () => accounts?.filter(a => ["investment", "savings"].includes(a.account_type) && a.status === "active") ?? [],
    [accounts]
  );

  const totalInvested = useMemo(
    () => investmentAccounts.reduce((s, a) => s + (a.current_balance || 0), 0),
    [investmentAccounts]
  );

  // Budget
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenseTransactions?.forEach((tx) => {
      if (tx.category_id) map.set(tx.category_id, (map.get(tx.category_id) || 0) + tx.amount);
    });
    return map;
  }, [expenseTransactions]);

  const currentBudgets = useMemo(
    () =>
      budgets
        ?.filter(b => b.month === selectedMonth.getMonth() + 1 && b.year === selectedMonth.getFullYear())
        .map(b => ({ ...b, spent: spentByCategory.get(b.category_id) || 0 })) ?? [],
    [budgets, spentByCategory, selectedMonth]
  );

  const { totalBudget, totalSpent, budgetPct, budgetRemaining } = useMemo(() => {
    const totalBudget = currentBudgets.reduce((s, b) => s + Number(b.amount), 0);
    const totalSpent = currentBudgets.reduce((s, b) => s + b.spent, 0);
    const budgetPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
    const budgetRemaining = totalBudget - totalSpent;
    return { totalBudget, totalSpent, budgetPct, budgetRemaining };
  }, [currentBudgets]);

  const { projectedExpenses, projectionDiff } = useMemo(() => {
    const today = new Date();
    const daysPassed = today.getDate();
    const totalDays = getDaysInMonth(selectedMonth);
    const projectedExpenses = daysPassed > 0 ? (totalSpent / daysPassed) * totalDays : 0;
    const projectionDiff = projectedExpenses - totalBudget;
    return { projectedExpenses, projectionDiff };
  }, [totalSpent, selectedMonth, totalBudget]);

  const investmentRate = useMemo(
    () => income > 0 ? (totalInvested / income) * 100 : 0,
    [totalInvested, income]
  );

  const { disciplineScore, accumulationRate, fixedExpenseRatio, independenceMonths } = useMemo(() => ({
    disciplineScore: totalBudget > 0 ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(budgetPct - 100)))) : 0,
    accumulationRate: income > 0 ? Math.round((savings / income) * 100) : 0,
    fixedExpenseRatio: income > 0 ? Math.round((expenses / income) * 100) : 0,
    independenceMonths: expenses > 0 ? Math.round(totalBalance / expenses) : 0,
  }), [totalBudget, budgetPct, income, savings, expenses, totalBalance]);

  const criticalCategories = useMemo(
    () =>
      [...currentBudgets]
        .sort((a, b) => (b.spent / Number(b.amount)) - (a.spent / Number(a.amount)))
        .slice(0, 5),
    [currentBudgets]
  );

  return {
    // Raw data
    monthTransactions,
    stats,
    error,
    statsLoading,
    accounts,
    // Aggregates
    income,
    expenses,
    savings,
    totalBalance,
    evolutionPct,
    // Accounts
    financialAccounts,
    investmentAccounts,
    totalInvested,
    investmentRate,
    // Budget
    currentBudgets,
    totalBudget,
    totalSpent,
    budgetPct,
    budgetRemaining,
    projectedExpenses,
    projectionDiff,
    // KPIs
    disciplineScore,
    accumulationRate,
    fixedExpenseRatio,
    independenceMonths,
    criticalCategories,
  };
}
