import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { MultiCurrencyBalanceSection } from "@/components/dashboard/MultiCurrencyBalanceSection";
import { UnclassifiedTransactionsAlert } from "@/components/dashboard/UnclassifiedTransactionsAlert";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardHoverTransactions } from "@/components/dashboard/StatCardHoverTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAccounts } from "@/hooks/useAccounts";
import { useBudgets } from "@/hooks/useBudgets";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { formatCurrency, parseLocalDate, shortenAccountName } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StaggerGrid, StaggerItem, AnimatedCard } from "@/components/ui/motion";
import { StatCardSkeleton } from "@/components/ui/premium-skeleton";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { Loader2, RefreshCw, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Building2, ChevronDown, ChevronUp, CalendarDays, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval, isWeekend } from "date-fns";
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

  const { isLoading: baseLoading, availableOrganizations, userRole } = useBaseFilterState();
  const { refreshOrganizations } = useBaseFilterActions();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Show provisioning screen for non-staff users with no organizations yet
  const isStaffRole = userRole && ["admin", "supervisor", "fa", "kam", "projetista"].includes(userRole);
  const isProvisioning = !baseLoading && !isStaffRole && availableOrganizations.length === 0;

  // Poll for organization provisioning (non-destructive — no page reload)
  useQuery({
    queryKey: ["provisioning-poll", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user!.id)
        .limit(1);
      if (data && data.length > 0) {
        refreshOrganizations();
      }
      return data || [];
    },
    enabled: isProvisioning && !!user,
    refetchInterval: 3000,
  });

  if (isProvisioning) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Configurando sua plataforma
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos preparando seu ambiente financeiro personalizado. Isso pode levar alguns instantes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>Finalizando configuração...</span>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-2">Verificando automaticamente...</p>
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
      <AppLayout title="Home">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <div className="text-center space-y-4">
            <div className="text-destructive text-lg font-medium">Erro ao carregar dados</div>
            <p className="text-muted-foreground">
              Não foi possível carregar as informações do dashboard.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Filter accounts for "Saldo Total" - exclude credit cards and investments
  const financialAccounts = accounts?.filter(a => a.account_type !== 'credit_card' && a.account_type !== 'investment' && a.status === 'active') || [];

  return (
    <AppLayout title="Dashboard">
      <WelcomeModal />
      <div className="space-y-7 w-full">
        {/* Financial Summary — Institutional Blue Panel */}
        <div className="-mx-5 md:mx-0 bg-[hsl(var(--brand-deep))] md:bg-[hsl(var(--brand-deep)/0.04)] md:border md:border-[hsl(var(--brand-deep)/0.08)] md:rounded-2xl overflow-hidden relative">
          {/* Subtle guilloche texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none md:hidden opacity-[0.04]"
            style={{
              backgroundImage: "url('/ibbra-grafismo.svg')",
              backgroundRepeat: "repeat",
              backgroundSize: "320px",
              backgroundPosition: "center",
            }}
          />

          <div className="relative px-5 pt-5 pb-6 md:px-6 md:py-5">
            {/* Month Selector */}
            <div className="flex justify-center mb-5 md:mb-4">
              <div className="inline-flex items-center rounded-full border border-white/15 md:border-border/40 bg-white/8 md:bg-card/80 px-4 py-1">
                <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} variant="overlay-mobile" />
              </div>
            </div>

            {/* Saldo Total — primary focus, full width */}
            {statsLoading ? (
              <div className="mb-3"><StatCardSkeleton /></div>
            ) : (
              <div
                className="mb-3 cursor-pointer"
                onClick={() => setShowAccountsDialog(true)}
              >
                <div className="rounded-[16px] bg-white/[0.06] border border-white/10 px-5 py-4 md:bg-card md:border-border/30">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/50 md:text-muted-foreground font-medium mb-1">
                    Saldo Total
                  </p>
                  <p
                    className="text-3xl font-light text-white md:text-foreground leading-none"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.02em" }}
                  >
                    <MaskedValue>{formatCurrency(stats?.totalBalance ?? 0)}</MaskedValue>
                  </p>
                  <p className="text-[10px] text-white/35 md:text-muted-foreground/50 mt-1.5 uppercase tracking-[0.1em]">
                    Posição patrimonial consolidada
                  </p>
                </div>
              </div>
            )}

            {/* Secondary cards: Evolução, Entradas, Saídas */}
            {/* Desktop: 4-column grid — Saldo Total spans 2 cols */}
            <div className="hidden md:grid grid-cols-4 gap-4 mb-2">
              {statsLoading ? (
                <>
                  <div className="col-span-2"><StatCardSkeleton /></div>
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </>
              ) : (
                <>
                  {/* Saldo Total — wide, institutional */}
                  <div
                    className="col-span-2 rounded-2xl border border-[hsl(var(--brand-deep)/0.15)] bg-[hsl(var(--brand-deep)/0.04)] px-7 py-5 cursor-pointer hover:bg-[hsl(var(--brand-deep)/0.07)] transition-all duration-300"
                    onClick={() => setShowAccountsDialog(true)}
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium mb-2">
                      Posição Patrimonial Consolidada
                    </p>
                    <p
                      className="text-4xl font-light text-foreground leading-none"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.03em" }}
                    >
                      <MaskedValue>{formatCurrency(stats?.totalBalance ?? 0)}</MaskedValue>
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-2.5 uppercase tracking-[0.1em]">
                      Saldo total · {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {/* Evolução Patrimonial */}
                  <div className="rounded-2xl border border-border/20 bg-card px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/55 font-medium mb-1.5">Evolução Patrimonial</p>
                    <p className="text-2xl font-light text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      <MaskedValue>{formatCurrency(stats?.monthlySavings ?? 0)}</MaskedValue>
                    </p>
                  </div>
                  {/* Entradas / Saídas stacked */}
                  <div className="flex flex-col gap-2.5">
                    <div
                      className="flex-1 rounded-xl border border-border/20 bg-card px-4 py-3 cursor-pointer hover:bg-muted/30 transition-all"
                      onClick={() => setShowIncomeDialog(true)}
                    >
                      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50 font-medium mb-1">Entradas</p>
                      <p className="text-lg font-light text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        <MaskedValue>{formatCurrency(stats?.monthlyIncome ?? 0)}</MaskedValue>
                      </p>
                    </div>
                    <div
                      className="flex-1 rounded-xl border border-border/20 border-l-2 border-l-destructive/30 bg-card px-4 py-3 cursor-pointer hover:bg-muted/30 transition-all"
                      onClick={() => setShowExpenseDialog(true)}
                    >
                      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50 font-medium mb-1">Saídas</p>
                      <p className="text-lg font-light text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        <MaskedValue>{formatCurrency(stats?.monthlyExpenses ?? 0)}</MaskedValue>
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile: existing layout */}
            <StaggerGrid className="grid gap-2 grid-cols-3 md:hidden">
              {statsLoading ? (
                <>
                  <StaggerItem><StatCardSkeleton /></StaggerItem>
                  <StaggerItem><StatCardSkeleton /></StaggerItem>
                  <StaggerItem><StatCardSkeleton /></StaggerItem>
                </>
              ) : (
                <>
                  <StaggerItem>
                    <div
                      className={cn(
                        "rounded-[14px] bg-white/[0.06] border border-white/10 px-3 py-3 md:bg-card md:border-border/30",
                        stats?.monthlySavings && stats.monthlySavings >= 0 ? "" : "border-l-2 border-l-[#FF4614]/60"
                      )}
                    >
                      <p className="text-[9px] uppercase tracking-[0.1em] text-white/45 md:text-muted-foreground font-medium leading-none mb-1.5">
                        Evolução
                      </p>
                      <p
                        className="text-sm font-light text-white md:text-foreground leading-none"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                      >
                        <MaskedValue>{formatCurrency(stats?.monthlySavings ?? 0)}</MaskedValue>
                      </p>
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div
                      className="rounded-[14px] bg-white/[0.06] border border-white/10 px-3 py-3 md:bg-card md:border-border/30 cursor-pointer"
                      onClick={() => setShowIncomeDialog(true)}
                    >
                      <p className="text-[9px] uppercase tracking-[0.1em] text-white/45 md:text-muted-foreground font-medium leading-none mb-1.5">
                        Entradas
                      </p>
                      <p
                        className="text-sm font-light text-white/90 md:text-foreground leading-none"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                      >
                        <MaskedValue>{formatCurrency(stats?.monthlyIncome ?? 0)}</MaskedValue>
                      </p>
                      {stats?.incomeChange !== undefined && (
                        <p className={cn("text-[9px] mt-1 font-medium", stats.incomeChange >= 0 ? "text-success/80" : "text-destructive/80")}>
                          {stats.incomeChange >= 0 ? "+" : ""}{stats.incomeChange.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div
                      className="rounded-[14px] bg-white/[0.06] border border-white/10 border-l-2 border-l-[#FF4614]/50 px-3 py-3 md:bg-card md:border-border/30 cursor-pointer"
                      onClick={() => setShowExpenseDialog(true)}
                    >
                      <p className="text-[9px] uppercase tracking-[0.1em] text-white/45 md:text-muted-foreground font-medium leading-none mb-1.5">
                        Saídas
                      </p>
                      <p
                        className="text-sm font-light text-white/90 md:text-foreground leading-none"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                      >
                        <MaskedValue>{formatCurrency(stats?.monthlyExpenses ?? 0)}</MaskedValue>
                      </p>
                      {stats?.expenseChange !== undefined && (
                        <p className={cn("text-[9px] mt-1 font-medium", stats.expenseChange <= 0 ? "text-success/80" : "text-destructive/80")}>
                          {stats.expenseChange <= 0 ? "" : "+"}{stats.expenseChange.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </StaggerItem>
                  </StaggerItem>
                </>
              )}
            </StaggerGrid>
          </div>
        </div>

        {/* Accounts breakdown dialog (mobile click) */}
        <Dialog open={showAccountsDialog} onOpenChange={setShowAccountsDialog}>
          <DialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Composição do Saldo Total
              </DialogTitle>
            </DialogHeader>
            <AccountsBreakdown accounts={financialAccounts} />
          </DialogContent>
        </Dialog>

        {/* Income transactions dialog */}
        <TransactionsListDialog
          open={showIncomeDialog}
          onOpenChange={setShowIncomeDialog}
          title="Entradas Financeiras do Mês"
          transactions={monthTransactions.filter(t => t.type === "income").sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())}
          variant="success"
          onEditTransaction={(tx) => { setEditingTransaction(tx); setEditDialogOpen(true); }}
        />

        {/* Expense transactions dialog */}
        <TransactionsListDialog
          open={showExpenseDialog}
          onOpenChange={setShowExpenseDialog}
          title="Saídas Financeiras do Mês"
          transactions={monthTransactions.filter(t => t.type === "expense").sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())}
          variant="destructive"
          onEditTransaction={(tx) => { setEditingTransaction(tx); setEditDialogOpen(true); }}
        />

        {/* Edit transaction dialog */}
        <TransactionDialog
          open={editDialogOpen}
          onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingTransaction(null); }}
          transaction={editingTransaction}
          defaultType="expense"
        />

        {/* 3. Main content with budget sidebar on desktop */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* Left: main content */}
          <div className="space-y-6 min-w-0">
            {/* Mobile: budget card inline */}
            <div className="block lg:hidden">
              <AnimatedCard delay={0.1}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-1">
                    <div>
                      <CardTitle className="text-sm font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Orçamentos</CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Acompanhamento e correções estratégicas mensais</p>
                    </div>
                    <Link to="/orcamentos">
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-xs">Ver todos</Badge>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InteractiveBudgetList selectedMonth={selectedMonth} />
                    <BudgetAlerts showNotifications={true} compact selectedMonth={selectedMonth} />
                    <UnclassifiedTransactionsAlert />
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>

            {/* Posição Multimoeda */}
            <AnimatedCard delay={0.15}>
              <MultiCurrencyBalanceSection />
            </AnimatedCard>

            {/* Distribuição por Categoria + Evolução Financeira */}
            <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <StaggerItem><CategoryDonutChart selectedMonth={selectedMonth} /></StaggerItem>
              <StaggerItem><MonthlyEvolutionChart selectedMonthFilter={selectedMonth} /></StaggerItem>
            </StaggerGrid>

          </div>

          {/* Right: Budget sidebar (desktop only) - single interactive card */}
          <div className="hidden lg:block">
            <div className="sticky top-4">
              <AnimatedCard delay={0.1}>
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold">Orçamentos & Alertas</CardTitle>
                    <Link to="/orcamentos">
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-[10px]">Ver todos</Badge>
                    </Link>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-4">
                    <InteractiveBudgetList selectedMonth={selectedMonth} />
                    <div className="border-t pt-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alertas</p>
                      <BudgetAlerts showNotifications={false} compact selectedMonth={selectedMonth} />
                    </div>
                    <UnclassifiedTransactionsAlert />
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>
          </div>
        </div>

        {/* Últimas Movimentações - full width */}
        <AnimatedCard delay={0.05}>
          <FintechTransactionsList selectedMonth={selectedMonth} />
        </AnimatedCard>
      </div>
    </AppLayout>
  );
};

/** Interactive budget list with click-to-expand details */
function InteractiveBudgetList({ selectedMonth }: { selectedMonth?: Date } = {}) {
  const { requiresBaseSelection } = useBaseFilter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refDate = selectedMonth || new Date();
  const startDate = format(startOfMonth(refDate), "yyyy-MM-dd");
  const endDate = format(endOfMonth(refDate), "yyyy-MM-dd");

  const { data: budgets, isLoading: budgetsLoading } = useBudgets();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    type: "expense",
    startDate,
    endDate,
  });

  const isLoading = budgetsLoading || transactionsLoading;

  const spentByCategory = useMemo(() => {
    const map = new Map<string, { total: number; dates: string[] }>();
    transactions?.forEach((tx) => {
      if (tx.category_id) {
        const current = map.get(tx.category_id) || { total: 0, dates: [] };
        current.total += tx.amount;
        current.dates.push(tx.date);
        map.set(tx.category_id, current);
      }
    });
    return map;
  }, [transactions]);

  const currentMonthBudgets = useMemo(() => {
    return budgets
      ?.filter((b) => b.month === refDate.getMonth() + 1 && b.year === refDate.getFullYear())
      .map((budget) => {
        const catData = spentByCategory.get(budget.category_id) || { total: 0, dates: [] };
        return { ...budget, spent: catData.total, txDates: catData.dates };
      })
      .slice(0, 8) || [];
  }, [budgets, spentByCategory, refDate]);

  if (requiresBaseSelection) return null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-24 rounded-md bg-muted animate-pulse" />
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!currentMonthBudgets || currentMonthBudgets.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-muted-foreground text-sm">
        Nenhum orçamento definido
      </div>
    );
  }

  // Calculate business days remaining in month
  const monthEnd = endOfMonth(refDate);
  const remainingDays = differenceInDays(monthEnd, refDate);
  const remainingBusinessDays = eachDayOfInterval({ start: refDate, end: monthEnd }).filter(d => !isWeekend(d)).length;

  return (
    <div className="space-y-1">
      {currentMonthBudgets.map((budget) => {
        const percentage = Math.min((budget.spent / budget.amount) * 100, 100);
        const isOverBudget = budget.spent > budget.amount;
        const remaining = budget.amount - budget.spent;
        const dailyAvgRemaining = remainingBusinessDays > 0 ? remaining / remainingBusinessDays : 0;
        const isExpanded = expandedId === budget.id;

        // Find exceeded date
        let exceededDate: string | null = null;
        if (isOverBudget && budget.txDates.length > 0) {
          const sortedDates = [...budget.txDates].sort();
          let runningTotal = 0;
          // We need to find when cumulative spending exceeded the budget
          const txsByDate = transactions?.filter(tx => tx.category_id === budget.category_id)
            .sort((a, b) => a.date.localeCompare(b.date)) || [];
          for (const tx of txsByDate) {
            runningTotal += tx.amount;
            if (runningTotal > budget.amount) {
              exceededDate = tx.date;
              break;
            }
          }
        }

        return (
          <div key={budget.id}>
            <button
              className={cn(
                "w-full text-left px-2 py-2 rounded-lg transition-colors hover:bg-muted/50",
                isExpanded && "bg-muted/40"
              )}
              onClick={() => setExpandedId(prev => prev === budget.id ? null : budget.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md text-primary-foreground text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: budget.categories?.color || "#6366f1" }}
                  >
                    {budget.categories?.name?.charAt(0) || "?"}
                  </div>
                  <span className="text-xs font-medium truncate">{budget.categories?.name || "Categoria"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold tabular-nums", isOverBudget && "text-destructive")}>
                    {formatCurrency(budget.spent)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/ {formatCurrency(budget.amount)}</span>
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
              <Progress value={percentage} className={cn("h-1.5", isOverBudget && "[&>div]:bg-destructive")} />
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mx-2 mb-2 mt-1 p-3 rounded-lg bg-muted/30 border border-border/40 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-start gap-2">
                    <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Utilizado</p>
                      <p className="text-xs font-semibold">{percentage.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Dias restantes</p>
                      <p className="text-xs font-semibold">{remainingDays}d ({remainingBusinessDays} úteis)</p>
                    </div>
                  </div>
                </div>

                {!isOverBudget && remaining > 0 && (
                  <div className="flex items-start gap-2 pt-1 border-t border-border/30">
                    <TrendingUp className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Média diária disponível</p>
                      <p className="text-xs font-semibold text-success">{formatCurrency(Math.max(dailyAvgRemaining, 0))}/dia útil</p>
                      <p className="text-[10px] text-muted-foreground">Restam {formatCurrency(remaining)}</p>
                    </div>
                  </div>
                )}

                {isOverBudget && (
                  <div className="flex items-start gap-2 pt-1 border-t border-border/30">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Orçamento excedido</p>
                      <p className="text-xs font-semibold text-destructive">
                        {formatCurrency(Math.abs(remaining))} acima do limite
                      </p>
                      {exceededDate && (
                        <p className="text-[10px] text-muted-foreground">
                          Excedido em {format(parseLocalDate(exceededDate), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Compact accounts list for hover/dialog - excludes credit cards */
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
      default: return 'Conta';
    }
  };

  return (
    <div className="p-2 space-y-1">
      {accounts.map((acc) => (
        <div key={acc.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: acc.color || "#3b82f6" }}
            >
              <Building2 className="h-3 w-3 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{shortenAccountName(acc.name, acc.account_type)}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {acc.bank_name || typeLabel(acc.account_type)}
              </p>
            </div>
          </div>
          <span className={cn(
            "text-xs font-semibold tabular-nums shrink-0",
            (acc.current_balance || 0) >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatCurrency(acc.current_balance || 0)}
          </span>
        </div>
      ))}
      <div className="border-t pt-1.5 mt-1.5 flex items-center justify-between px-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
        <span className="text-xs font-bold tabular-nums">
          {formatCurrency(accounts.reduce((s, a) => s + (a.current_balance || 0), 0))}
        </span>
      </div>
    </div>
  );
}

/** Transactions list modal for StatCard click */
function TransactionsListDialog({
  open,
  onOpenChange,
  title,
  transactions,
  variant,
  onEditTransaction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  transactions: Transaction[];
  variant: "success" | "destructive";
  onEditTransaction: (tx: Transaction) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-hidden flex flex-col w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            {variant === "success" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-2 px-2">
          {transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sem movimentações no mês</p>
          ) : (
            <div className="space-y-0.5">
              {transactions.slice(0, 30).map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => { onOpenChange(false); setTimeout(() => onEditTransaction(tx), 200); }}
                  className="flex items-center justify-between gap-2 w-full px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{tx.description || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tx.categories?.name || "Sem categoria"} · {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                    </p>
                  </div>
                  <span className={cn("text-xs font-semibold tabular-nums shrink-0", variant === "success" ? "text-success" : "text-destructive")}>
                    {variant === "success" ? "+ " : "− "}{formatCurrency(Math.abs(Number(tx.amount)))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Index;
