import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { UnclassifiedTransactionsAlert } from "@/components/dashboard/UnclassifiedTransactionsAlert";

import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAccounts } from "@/hooks/useAccounts";
import { useBudgets } from "@/hooks/useBudgets";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AnimatedCard } from "@/components/ui/motion";
import { StatCardSkeleton } from "@/components/ui/premium-skeleton";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import {
  Loader2, RefreshCw, Wallet, ArrowUpRight, ArrowDownRight,
  TrendingUp, ChevronDown, ChevronUp, CalendarDays,
  Target, AlertTriangle, PiggyBank, Gauge, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval, isWeekend, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBaseFilter, useBaseFilterState, useBaseFilterActions } from "@/contexts/BaseFilterContext";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useQuery } from "@tanstack/react-query";
import { WelcomeModal } from "@/components/dashboard/WelcomeModal";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { data: stats, error, isLoading: statsLoading } = useDashboardStats(selectedMonth);
  const { data: accounts } = useAccounts();
  const [showAccountsDialog, setShowAccountsDialog] = useState(false);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: allTransactions } = useTransactions({});
  const selMonth = selectedMonth.getMonth();
  const selYear = selectedMonth.getFullYear();
  const monthTransactions = allTransactions?.filter((t) => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === selMonth && d.getFullYear() === selYear;
  }) || [];

  const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  const { data: budgets } = useBudgets(selectedMonth.getMonth() + 1, selectedMonth.getFullYear());
  const { data: expenseTransactions } = useTransactions({ type: "expense", startDate, endDate });

  const { isLoading: baseLoading, availableOrganizations, userRole } = useBaseFilterState();
  const { refreshOrganizations } = useBaseFilterActions();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const isStaffRole = userRole && ["admin", "supervisor", "fa", "kam", "projetista"].includes(userRole);
  const isProvisioning = !baseLoading && !isStaffRole && availableOrganizations.length === 0;

  // Poll for org provisioning
  useQuery({
    queryKey: ["provisioning-poll", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user!.id)
        .limit(1);
      if (data && data.length > 0) refreshOrganizations();
      return data || [];
    },
    enabled: isProvisioning && !!user,
    refetchInterval: 3000,
  });

  if (isProvisioning) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Configurando sua plataforma</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos preparando seu ambiente personalizado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (baseLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <AppLayout title="Visão Geral">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <div className="text-center space-y-4">
            <div className="text-destructive text-lg font-medium">Erro ao carregar dados</div>
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const financialAccounts = accounts?.filter(
    a => a.account_type !== 'credit_card' && a.account_type !== 'investment' && a.status === 'active'
  ) || [];

  const income = stats?.monthlyIncome ?? 0;
  const expenses = stats?.monthlyExpenses ?? 0;
  const savings = stats?.monthlySavings ?? 0;
  const totalBalance = stats?.totalBalance ?? 0;
  const evolutionPct = income > 0 ? ((savings / income) * 100) : 0;

  // Budget calculations
  const spentByCategory = new Map<string, number>();
  expenseTransactions?.forEach((tx) => {
    if (tx.category_id) {
      spentByCategory.set(tx.category_id, (spentByCategory.get(tx.category_id) || 0) + tx.amount);
    }
  });

  const currentBudgets = budgets
    ?.filter(b => b.month === selectedMonth.getMonth() + 1 && b.year === selectedMonth.getFullYear())
    .map(b => ({ ...b, spent: spentByCategory.get(b.category_id) || 0 })) || [];

  const totalBudget = currentBudgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = currentBudgets.reduce((s, b) => s + b.spent, 0);
  const budgetPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const budgetRemaining = totalBudget - totalSpent;

  // Month projection
  const today = new Date();
  const daysPassed = today.getDate();
  const totalDays = getDaysInMonth(selectedMonth);
  const projectedExpenses = daysPassed > 0 ? (totalSpent / daysPassed) * totalDays : 0;
  const projectionDiff = projectedExpenses - totalBudget;

  // Investment accounts
  const investmentAccounts = accounts?.filter(a => a.account_type === 'investment' && a.status === 'active') || [];
  const totalInvested = investmentAccounts.reduce((s, a) => s + (a.current_balance || 0), 0);
  const investmentRate = income > 0 ? ((totalInvested / income) * 100) : 0;

  // KPIs
  const disciplineScore = totalBudget > 0 ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(budgetPct - 100)))) : 0;
  const accumulationRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  const fixedExpenseRatio = income > 0 ? Math.round((expenses / income) * 100) : 0;
  const independenceMonths = expenses > 0 ? Math.round(totalBalance / expenses) : 0;

  // Critical categories (top 5 by spend vs budget)
  const criticalCategories = [...currentBudgets]
    .sort((a, b) => (b.spent / Number(b.amount)) - (a.spent / Number(a.amount)))
    .slice(0, 5);

  return (
    <AppLayout title="Visão Geral">
      <WelcomeModal />
      <div className="space-y-8 w-full">

        {/* ── Month selector ── */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border border-border/40 bg-card px-4 py-1.5 shadow-fintech">
            <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </div>
        </div>

        {/* ══════════════════════════════════════════
            DASHBOARD — Layout 1.6fr / 1fr
            ══════════════════════════════════════════ */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-6 min-w-0">

            {/* 1 — PATRIMÔNIO CONSOLIDADO */}
            <AnimatedCard>
              <Card className="overflow-hidden">
                <div className="bg-primary p-6 md:p-8">
                  <button className="w-full text-left group" onClick={() => setShowAccountsDialog(true)}>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-primary-foreground/40 mb-3">
                      Patrimônio Consolidado
                    </p>
                    <p className="text-3xl md:text-4xl font-bold text-primary-foreground leading-none mb-4 tracking-tight">
                      <MaskedValue>{formatCurrency(totalBalance)}</MaskedValue>
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <button onClick={(e) => { e.stopPropagation(); setShowIncomeDialog(true); }} className="text-left">
                        <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Receitas</p>
                        <p className="text-sm font-semibold text-primary-foreground/90">
                          <MaskedValue>{formatCurrency(income)}</MaskedValue>
                        </p>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowExpenseDialog(true); }} className="text-left">
                        <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Despesas</p>
                        <p className="text-sm font-semibold text-primary-foreground/90">
                          <MaskedValue>{formatCurrency(expenses)}</MaskedValue>
                        </p>
                      </button>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Evolução</p>
                        <p className={cn("text-sm font-semibold", evolutionPct >= 0 ? "text-emerald-300" : "text-red-300")}>
                          {evolutionPct >= 0 ? "+" : ""}{evolutionPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </Card>
            </AnimatedCard>

            {/* 2 — EVOLUÇÃO FINANCEIRA (12 meses) */}
            <AnimatedCard delay={0.05}>
              <Card>
                <CardHeader className="pb-2 pt-5 px-6">
                  <CardTitle className="text-base font-semibold">Evolução Financeira</CardTitle>
                  <p className="text-xs text-muted-foreground">Patrimônio, aportes e crescimento — 12 meses</p>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <MonthlyEvolutionChart selectedMonthFilter={selectedMonth} />
                </CardContent>
              </Card>
            </AnimatedCard>

            {/* 3 — CONTROLE ORÇAMENTÁRIO (card principal) */}
            <AnimatedCard delay={0.1}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
                  <div>
                    <CardTitle className="text-base font-semibold">Controle Orçamentário</CardTitle>
                    <p className="text-xs text-muted-foreground">Planejado vs realizado no mês</p>
                  </div>
                  <Link to="/orcamentos">
                    <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-xs">Ver plano</Badge>
                  </Link>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-5">
                  {/* Summary numbers */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Planejado</p>
                      <p className="text-lg font-bold"><MaskedValue>{formatCurrency(totalBudget)}</MaskedValue></p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                      <p className={cn("text-lg font-bold", totalSpent > totalBudget && "text-destructive")}>
                        <MaskedValue>{formatCurrency(totalSpent)}</MaskedValue>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Disponível</p>
                      <p className={cn("text-lg font-bold", budgetRemaining >= 0 ? "text-success" : "text-destructive")}>
                        <MaskedValue>{formatCurrency(budgetRemaining)}</MaskedValue>
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div>
                    <Progress value={budgetPct} className={cn("h-3 rounded-full", totalSpent > totalBudget && "[&>div]:bg-destructive")} />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">{budgetPct.toFixed(0)}% utilizado</p>
                      <Badge variant={budgetRemaining >= 0 ? "outline" : "destructive"} className="text-[10px]">
                        {budgetRemaining >= 0 ? "Dentro do planejamento" : "Acima do limite"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>

            {/* 6 — CATEGORIAS CRÍTICAS */}
            {criticalCategories.length > 0 && (
              <AnimatedCard delay={0.15}>
                <Card>
                  <CardHeader className="pb-2 pt-5 px-6">
                    <CardTitle className="text-base font-semibold">Categorias Críticas</CardTitle>
                    <p className="text-xs text-muted-foreground">Maior impacto no orçamento</p>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 space-y-3">
                    {criticalCategories.map((b) => {
                      const pct = Math.min((b.spent / Number(b.amount)) * 100, 100);
                      const over = b.spent > Number(b.amount);
                      return (
                        <div key={b.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{b.categories?.name || "Categoria"}</span>
                            <span className={cn("text-xs font-semibold tabular-nums", over && "text-destructive")}>
                              {formatCurrency(b.spent)} / {formatCurrency(Number(b.amount))}
                            </span>
                          </div>
                          <Progress value={pct} className={cn("h-2 rounded-full", over && "[&>div]:bg-destructive")} />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </AnimatedCard>
            )}

            {/* 8 — MOVIMENTAÇÕES RECENTES */}
            <AnimatedCard delay={0.2}>
              <Card>
                <CardHeader className="pb-2 pt-5 px-6">
                  <CardTitle className="text-base font-semibold">Movimentações Recentes</CardTitle>
                  <p className="text-xs text-muted-foreground">Últimas transações do período</p>
                </CardHeader>
              </Card>
              <FintechTransactionsList selectedMonth={selectedMonth} />
            </AnimatedCard>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-4 space-y-6">

              {/* 4 — PROJEÇÃO DO MÊS */}
              <AnimatedCard delay={0.05}>
                <Card>
                  <CardHeader className="pb-2 pt-5 px-6">
                    <CardTitle className="text-base font-semibold">Projeção do Mês</CardTitle>
                    <p className="text-xs text-muted-foreground">Previsão baseada no ritmo atual</p>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-secondary/50">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Orçamento</p>
                        <p className="text-lg font-bold"><MaskedValue>{formatCurrency(totalBudget)}</MaskedValue></p>
                      </div>
                      <div className="p-4 rounded-2xl bg-secondary/50">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Projeção</p>
                        <p className={cn("text-lg font-bold", projectionDiff > 0 ? "text-destructive" : "text-success")}>
                          <MaskedValue>{formatCurrency(projectedExpenses)}</MaskedValue>
                        </p>
                      </div>
                    </div>
                    {totalBudget > 0 && (
                      <div className={cn("p-3 rounded-xl text-sm font-medium flex items-center gap-2",
                        projectionDiff > 0
                          ? "bg-destructive/8 text-destructive"
                          : "bg-success/8 text-success"
                      )}>
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {projectionDiff > 0
                          ? `Previsão de estouro de ${formatCurrency(projectionDiff)}`
                          : `Economia projetada de ${formatCurrency(Math.abs(projectionDiff))}`
                        }
                      </div>
                    )}
                  </CardContent>
                </Card>
              </AnimatedCard>

              {/* 5 — INVESTIMENTOS */}
              <AnimatedCard delay={0.1}>
                <Card>
                  <CardHeader className="pb-2 pt-5 px-6">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <PiggyBank className="h-4 w-4 text-muted-foreground" />
                      Investimentos
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Acumulação patrimonial</p>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total investido</p>
                        <p className="text-lg font-bold"><MaskedValue>{formatCurrency(totalInvested)}</MaskedValue></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Taxa acumulação</p>
                        <p className="text-lg font-bold">{investmentRate.toFixed(0)}%</p>
                        <p className="text-[10px] text-muted-foreground">investimentos ÷ renda</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>

              {/* KPIs — INDICADORES FINANCEIROS */}
              <AnimatedCard delay={0.15}>
                <Card>
                  <CardHeader className="pb-2 pt-5 px-6">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      Indicadores Financeiros
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 space-y-4">
                    {/* Discipline Score */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Disciplina Financeira</p>
                        <p className="text-[10px] text-muted-foreground">planejado vs realizado</p>
                      </div>
                      <div className={cn(
                        "text-lg font-bold",
                        disciplineScore >= 80 ? "text-success" : disciplineScore >= 50 ? "text-warning" : "text-destructive"
                      )}>
                        {disciplineScore}
                        <span className="text-xs text-muted-foreground font-normal">/100</span>
                      </div>
                    </div>

                    <div className="border-t border-border/30" />

                    {/* Accumulation Rate */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Acumulação Patrimonial</p>
                        <p className="text-[10px] text-muted-foreground">poupança ÷ renda</p>
                      </div>
                      <div className={cn(
                        "text-lg font-bold",
                        accumulationRate >= 20 ? "text-success" : accumulationRate >= 0 ? "text-warning" : "text-destructive"
                      )}>
                        {accumulationRate}%
                      </div>
                    </div>

                    <div className="border-t border-border/30" />

                    {/* Fixed Expense Ratio */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Estabilidade Financeira</p>
                        <p className="text-[10px] text-muted-foreground">despesas ÷ renda</p>
                      </div>
                      <div className={cn(
                        "text-lg font-bold",
                        fixedExpenseRatio <= 70 ? "text-success" : fixedExpenseRatio <= 90 ? "text-warning" : "text-destructive"
                      )}>
                        {fixedExpenseRatio}%
                      </div>
                    </div>

                    <div className="border-t border-border/30" />

                    {/* Financial Independence */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Independência</p>
                          <p className="text-[10px] text-muted-foreground">patrimônio ÷ despesas mensais</p>
                        </div>
                      </div>
                      <div className="text-lg font-bold">
                        {independenceMonths}
                        <span className="text-xs text-muted-foreground font-normal"> meses</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>

              {/* 7 — ALERTAS FINANCEIROS */}
              <AnimatedCard delay={0.2}>
                <Card>
                  <CardHeader className="pb-2 pt-5 px-6">
                    <CardTitle className="text-base font-semibold">Alertas Financeiros</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <BudgetAlerts showNotifications={false} compact selectedMonth={selectedMonth} />
                    <UnclassifiedTransactionsAlert />
                  </CardContent>
                </Card>
              </AnimatedCard>

            </div>
          </div>
        </div>

        {/* ── Dialogs ── */}
        <Dialog open={showAccountsDialog} onOpenChange={setShowAccountsDialog}>
          <DialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Composição Patrimonial
              </DialogTitle>
            </DialogHeader>
            <AccountsBreakdown accounts={financialAccounts} />
          </DialogContent>
        </Dialog>

        <TransactionsListDialog
          open={showIncomeDialog}
          onOpenChange={setShowIncomeDialog}
          title="Receitas do Período"
          transactions={monthTransactions.filter(t => t.type === "income").sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())}
          variant="success"
          onEditTransaction={(tx) => { setEditingTransaction(tx); setEditDialogOpen(true); }}
        />

        <TransactionsListDialog
          open={showExpenseDialog}
          onOpenChange={setShowExpenseDialog}
          title="Despesas do Período"
          transactions={monthTransactions.filter(t => t.type === "expense").sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())}
          variant="destructive"
          onEditTransaction={(tx) => { setEditingTransaction(tx); setEditDialogOpen(true); }}
        />

        <TransactionDialog
          open={editDialogOpen}
          onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingTransaction(null); }}
          transaction={editingTransaction}
          defaultType="expense"
        />
      </div>
    </AppLayout>
  );
};

// ── Accounts breakdown ──
function AccountsBreakdown({ accounts }: { accounts: Array<{ id: string; name: string; bank_name: string | null; current_balance: number | null; account_type: string; color: string | null }> }) {
  if (!accounts || accounts.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>
      </div>
    );
  }

  const typeLabel = (t: string) => {
    switch (t) {
      case 'checking': return 'Conta Corrente';
      case 'savings': return 'Poupança';
      case 'cash': return 'Dinheiro';
      case 'investment': return 'Investimento';
      default: return t;
    }
  };

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto overscroll-contain">
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: a.color || "hsl(var(--primary))" }}>
              <Wallet className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.name}</p>
              <p className="text-[10px] text-muted-foreground">{a.bank_name || typeLabel(a.account_type)}</p>
            </div>
          </div>
          <p className="text-sm font-semibold tabular-nums shrink-0 ml-3">
            <MaskedValue>{formatCurrency(a.current_balance ?? 0)}</MaskedValue>
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Transactions list dialog ──
function TransactionsListDialog({
  open,
  onOpenChange,
  title,
  transactions,
  variant,
  onEditTransaction,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  transactions: Transaction[];
  variant: "success" | "destructive";
  onEditTransaction: (tx: Transaction) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto overscroll-contain">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação</p>
          ) : (
            transactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => { onEditTransaction(tx); onOpenChange(false); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary/40 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{tx.description || "Sem descrição"}</p>
                  <p className="text-[10px] text-muted-foreground">{tx.categories?.name}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={cn("text-sm font-semibold tabular-nums", variant === "success" ? "text-success" : "text-destructive")}>
                    <MaskedValue>{formatCurrency(tx.amount)}</MaskedValue>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Index;
