import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { ReconciliationMetricsCard } from "@/components/dashboard/ReconciliationMetricsCard";
import { ConnectedAccountsSection } from "@/components/dashboard/ConnectedAccountsSection";
import { MultiCurrencyBalanceSection } from "@/components/dashboard/MultiCurrencyBalanceSection";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardHoverTransactions } from "@/components/dashboard/StatCardHoverTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StaggerGrid, StaggerItem, AnimatedCard } from "@/components/ui/motion";
import { StatCardSkeleton } from "@/components/ui/premium-skeleton";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { Loader2, RefreshCw, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/formatters";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: stats, error, isLoading: statsLoading } = useDashboardStats();
  const { data: accounts } = useAccounts();
  const [showAccountsDialog, setShowAccountsDialog] = useState(false);
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: allTransactions } = useTransactions({});
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthTransactions = allTransactions?.filter((t) => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

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

  // Filter accounts for "Posição Financeira" - exclude credit cards and investments
  const financialAccounts = accounts?.filter(a => a.account_type !== 'credit_card' && a.account_type !== 'investment') || [];

  return (
    <AppLayout title="Consolidação Patrimonial">
      <div className="space-y-6 w-full">
        {/* 1. Stat Cards */}
        <div className="relative">
          <div className="absolute inset-x-0 -mx-4 bg-[hsl(var(--sidebar-background))] rounded-b-3xl md:hidden" style={{ top: '-4rem', bottom: '-0.75rem' }} />
          <StaggerGrid className="relative grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {statsLoading ? (
              <>
                <StaggerItem><StatCardSkeleton /></StaggerItem>
                <StaggerItem><StatCardSkeleton /></StaggerItem>
                <StaggerItem><StatCardSkeleton /></StaggerItem>
                <StaggerItem><StatCardSkeleton /></StaggerItem>
              </>
            ) : (
              <>
                <StaggerItem>
                  <StatCard
                    title="Posição Financeira"
                    value={formatCurrency(stats?.totalBalance ?? 0)}
                    icon={<Wallet className="h-5 w-5" />}
                    variant="default"
                    onClick={() => setShowAccountsDialog(true)}
                    hoverContent={
                      <AccountsBreakdown accounts={financialAccounts} />
                    } />
                </StaggerItem>
                <StaggerItem>
                  <StatCard
                    title="Entradas Financeiras"
                    value={formatCurrency(stats?.monthlyIncome ?? 0)}
                    icon={<ArrowUpRight className="h-5 w-5" />}
                    variant="success"
                    trend={stats?.incomeChange ? { value: stats.incomeChange, isPositive: stats.incomeChange >= 0 } : undefined}
                    onClick={() => setShowIncomeDialog(true)}
                    hoverContent={<StatCardHoverTransactions type="income" />} />
                </StaggerItem>
                <StaggerItem>
                  <StatCard
                    title="Saídas Financeiras"
                    value={"− " + formatCurrency(stats?.monthlyExpenses ?? 0)}
                    icon={<ArrowDownRight className="h-5 w-5" />}
                    variant="destructive"
                    trend={stats?.expenseChange ? { value: Math.abs(stats.expenseChange), isPositive: stats.expenseChange <= 0 } : undefined}
                    onClick={() => setShowExpenseDialog(true)}
                    hoverContent={<StatCardHoverTransactions type="expense" />} />
                </StaggerItem>
                <StaggerItem>
                  <StatCard
                    title="Evolução Patrimonial"
                    value={formatCurrency(stats?.monthlySavings ?? 0)}
                    icon={<TrendingUp className="h-5 w-5" />}
                    variant={stats?.monthlySavings && stats.monthlySavings >= 0 ? "success" : "warning"} />
                </StaggerItem>
              </>
            )}
          </StaggerGrid>
        </div>

        {/* Accounts breakdown dialog (mobile click) */}
        <Dialog open={showAccountsDialog} onOpenChange={setShowAccountsDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Composição da Posição Financeira
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

        {/* 2. Main content with budget sidebar on desktop */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* Left: main content */}
          <div className="space-y-6 min-w-0">
            {/* Mobile: budget card inline */}
            <div className="block lg:hidden">
              <AnimatedCard delay={0.1}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-semibold">Orçamentos & Alertas</CardTitle>
                    <Link to="/orcamentos">
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-xs">Ver todos</Badge>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <BudgetProgress inline />
                    <BudgetAlerts showNotifications={true} compact />
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
              <StaggerItem><CategoryDonutChart /></StaggerItem>
              <StaggerItem><MonthlyEvolutionChart /></StaggerItem>
            </StaggerGrid>

            {/* Últimas Movimentações */}
            <AnimatedCard delay={0.05}>
              <FintechTransactionsList />
            </AnimatedCard>

            {/* Conciliação */}
            <AnimatedCard delay={0.05}>
              <ReconciliationMetricsCard />
            </AnimatedCard>

            {/* Contas Conectadas */}
            <AnimatedCard delay={0.05}>
              <ConnectedAccountsSection compact />
            </AnimatedCard>
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
                    <BudgetProgress inline />
                    <div className="border-t pt-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alertas</p>
                      <BudgetAlerts showNotifications={false} compact />
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

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
              <p className="text-xs font-medium truncate">{acc.name}</p>
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
      <DialogContent className="max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
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