import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { CircuitBreakerBanner } from "@/components/open-finance/CircuitBreakerBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useAchievementChecker } from "@/hooks/useAchievementChecker";

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
  TrendingUp, ChevronDown, ChevronUp, Target, AlertTriangle, PiggyBank, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
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

  // Achievement checker
  useAchievementChecker(selectedMonth);

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
      <CircuitBreakerBanner />
      <div className="space-y-8 w-full">

        {/* ── Month selector ── */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border border-border/40 bg-card px-2 py-0.5 shadow-fintech">
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
                    <p className="text-2xl md:text-4xl font-bold text-primary-foreground leading-none mb-4 tracking-tight tabular-nums min-w-0 break-all" style={{ fontSize: "clamp(1.4rem, 5vw, 2.5rem)" }}>
                      <MaskedValue>{formatCurrency(totalBalance)}</MaskedValue>
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={(e) => { e.stopPropagation(); setShowIncomeDialog(true); }} className="text-left min-w-0">
                        <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Receitas</p>
                        <p className="text-xs font-semibold text-primary-foreground/90 truncate tabular-nums">
                          <MaskedValue>{formatCurrency(income)}</MaskedValue>
                        </p>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowExpenseDialog(true); }} className="text-left min-w-0">
                        <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Despesas</p>
                        <p className="text-xs font-semibold text-primary-foreground/90 truncate tabular-nums">
                          <MaskedValue>{formatCurrency(expenses)}</MaskedValue>
                        </p>
                      </button>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Evolução do Mês</p>
                        <p className={cn("text-xs font-semibold truncate tabular-nums", evolutionPct >= 0 ? "text-success" : "text-destructive")}>
                          {evolutionPct >= 0 ? "+" : ""}{evolutionPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </Card>
            </AnimatedCard>


            {/* 8 — MOVIMENTAÇÕES RECENTES */}
            <AnimatedCard delay={0.2}>
              <FintechTransactionsList selectedMonth={selectedMonth} />
            </AnimatedCard>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-4 space-y-6">


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
