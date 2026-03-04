import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBudgetAnalysis } from "@/hooks/useBudgetAnalysis";
import { useMonthlyPlan } from "@/hooks/useMonthlyPlan";
import { useTransactions } from "@/hooks/useTransactions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { parseLocalDate } from "@/lib/formatters";
import { Target, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface Props {
  selectedMonth: Date;
}

export function FinancialDisciplineScore({ selectedMonth }: Props) {
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
    const budgetPts = Math.round(budgetPct * 40);
    total += budgetPts;
    if (budgetPts < 40) {
      const over = totalCategories - withinBudget;
      tips.push(`${over} categoria${over > 1 ? "s" : ""} estourou o orçamento`);
    }

    // 30 pts: investment >= target
    const investmentTarget = plan?.investment_target ?? 0;
    const totalInvested = (monthTx || [])
      .filter(t => t.type === "expense" && t.categories?.name?.toLowerCase().includes("investimento"))
      .reduce((s, t) => s + Number(t.amount), 0);
    if (investmentTarget > 0 && totalInvested >= investmentTarget) {
      total += 30;
    } else if (investmentTarget > 0) {
      tips.push("Investimento abaixo da meta mensal");
    } else {
      // No target set — give partial credit
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Disciplina Financeira</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  const color = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive";
  const ringColor = score >= 70 ? "stroke-success" : score >= 40 ? "stroke-warning" : "stroke-destructive";
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Disciplina Financeira</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-4">
        {/* Circle score */}
        <div className="relative h-32 w-32">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" className="stroke-muted/30" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              className={cn(ringColor, "transition-all duration-700")}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-3xl font-bold", color)} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {score}
            </span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Tips */}
        {tips.length > 0 && (
          <div className="w-full space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}

        {tips.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Disciplina perfeita!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
