import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { CircuitBreakerBanner } from "@/components/open-finance/CircuitBreakerBanner";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCardBoundary } from "@/components/dashboard/DashboardCardBoundary";
import { AccountsBreakdown } from "@/components/dashboard/AccountsBreakdown";
import { TransactionsListDialog } from "@/components/dashboard/TransactionsListDialog";
import { useAchievementChecker } from "@/hooks/useAchievementChecker";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnimatedCard } from "@/components/ui/motion";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { Transaction } from "@/hooks/useTransactions";
import { Loader2, RefreshCw, Wallet, Target, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBaseFilterState, useBaseFilterActions } from "@/contexts/BaseFilterContext";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useQuery } from "@tanstack/react-query";
import { WelcomeModal } from "@/components/dashboard/WelcomeModal";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAccountsDialog, setShowAccountsDialog] = useState(false);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useAchievementChecker(selectedMonth);

  const { isLoading: baseLoading, availableOrganizations, userRole } = useBaseFilterState();
  const { refreshOrganizations } = useBaseFilterActions();

  const {
    monthTransactions, error, statsLoading,
    income, expenses, savings, totalBalance, evolutionPct,
    financialAccounts, investmentAccounts, totalInvested, investmentRate,
    totalBudget, budgetPct, budgetRemaining,
  } = useDashboardKPIs(selectedMonth);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const isStaffRole = userRole && ["admin", "supervisor", "fa", "kam", "projetista"].includes(userRole);
  const isProvisioning = !baseLoading && userRole !== null && !isStaffRole && availableOrganizations.length === 0;

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

  if (loading || baseLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  if (isProvisioning) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Configurando sua plataforma</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Estamos preparando seu ambiente personalizado.</p>
          </div>
        </div>
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
              <RefreshCw className="h-4 w-4 mr-2" />Recarregar
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const incomeTransactions = monthTransactions.filter(t => t.type === "income").sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
  const expenseTransactionsList = monthTransactions.filter(t => t.type === "expense").sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

  return (
    <AppLayout title="Visão Geral">
      <WelcomeModal />
      <CircuitBreakerBanner />
      <div className="space-y-8 w-full">

        <div className="flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border border-border/30 bg-card/80 px-1.5 py-px">
            <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </div>
        </div>

        <div className="space-y-6">
          {/* Saldo consolidado */}
          <AnimatedCard>
            <Card className="overflow-hidden">
              <div className="bg-primary p-6 md:p-8">
                <button className="w-full text-left group" onClick={() => setShowAccountsDialog(true)}>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-primary-foreground/40 mb-3">Saldo Total</p>
                  <p className="text-2xl md:text-4xl font-bold text-primary-foreground leading-none mb-4 tracking-tight tabular-nums min-w-0 break-all" style={{ fontSize: "clamp(1.4rem, 5vw, 2.5rem)" }}>
                    <MaskedValue>{formatCurrency(totalBalance)}</MaskedValue>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={(e) => { e.stopPropagation(); setShowIncomeDialog(true); }} className="text-left min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Receitas</p>
                      <p className="text-xs font-semibold text-primary-foreground/90 truncate tabular-nums"><MaskedValue>{formatCurrency(income)}</MaskedValue></p>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowExpenseDialog(true); }} className="text-left min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-primary-foreground/30 mb-1">Despesas</p>
                      <p className="text-xs font-semibold text-primary-foreground/90 truncate tabular-nums"><MaskedValue>{formatCurrency(expenses)}</MaskedValue></p>
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

          {/* Mini cards */}
          <AnimatedCard delay={0.05}>
            <div className="grid grid-cols-2 gap-3">
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                      <Target className="h-3.5 w-3.5 text-warning" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">Orçamento</p>
                  </div>
                  {totalBudget > 0 ? (
                    <>
                      <p className="text-base font-bold tabular-nums text-foreground mb-1"><MaskedValue>{Math.round(budgetPct)}%</MaskedValue></p>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                        <div className={cn("h-full rounded-full transition-all", budgetPct >= 100 ? "bg-destructive" : budgetPct >= 80 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                        <MaskedValue>{formatCurrency(Math.abs(budgetRemaining))}</MaskedValue>
                        <span className="ml-1">{budgetRemaining >= 0 ? "restante" : "excedido"}</span>
                      </p>
                    </>
                  ) : <p className="text-xs text-muted-foreground">Sem orçamento</p>}
                </CardContent>
              </Card>
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <PiggyBank className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">Investimentos</p>
                  </div>
                  <p className="text-base font-bold tabular-nums text-foreground mb-1"><MaskedValue>{formatCurrency(totalInvested)}</MaskedValue></p>
                  {income > 0 && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      <span className={cn("font-semibold", investmentRate >= 20 ? "text-success" : investmentRate >= 10 ? "text-warning" : "text-muted-foreground")}>
                        {investmentRate.toFixed(1)}%
                      </span>
                      {" da receita"}
                    </p>
                  )}
                  {investmentAccounts.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">{investmentAccounts.length} conta{investmentAccounts.length > 1 ? "s" : ""}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </AnimatedCard>

          {/* Transações */}
          <AnimatedCard delay={0.1}>
            <DashboardCardBoundary label="Movimentações Recentes">
              <FintechTransactionsList selectedMonth={selectedMonth} />
            </DashboardCardBoundary>
          </AnimatedCard>
        </div>

        {/* Dialogs */}
        <Dialog open={showAccountsDialog} onOpenChange={setShowAccountsDialog}>
          <DialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" />Composição Patrimonial</DialogTitle></DialogHeader>
            <AccountsBreakdown accounts={financialAccounts} />
          </DialogContent>
        </Dialog>

        <TransactionsListDialog open={showIncomeDialog} onOpenChange={setShowIncomeDialog} title="Receitas do Período" transactions={incomeTransactions} variant="success" onEditTransaction={(tx) => { setEditingTransaction(tx); setEditDialogOpen(true); }} />
        <TransactionsListDialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog} title="Despesas do Período" transactions={expenseTransactionsList} variant="destructive" onEditTransaction={(tx) => { setEditingTransaction(tx); setEditDialogOpen(true); }} />

        <TransactionDialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingTransaction(null); }} transaction={editingTransaction} defaultType="expense" />
      </div>
    </AppLayout>
  );
};

export default Index;
