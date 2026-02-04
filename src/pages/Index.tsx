import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { AIAssistantChat } from "@/components/ai/AIAssistantChat";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { ImportCard } from "@/components/import/ImportCard";
import { ReconciliationMetricsCard } from "@/components/dashboard/ReconciliationMetricsCard";
import { StrategicInsightsCard } from "@/components/dashboard/StrategicInsightsCard";
import { TransactionsDetailModal } from "@/components/dashboard/TransactionsDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useTransactions } from "@/hooks/useTransactions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Loader2, RefreshCw } from "lucide-react";
import { formatCurrency as formatCurrencyUtil } from "@/lib/formatters";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useDashboardStats();
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    type: "income" | "expense";
    title: string;
    value: number;
  }>({ open: false, type: "income", title: "", value: 0 });

  // Fetch transactions for hover content
  const { data: allTransactions } = useTransactions({});

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const formatCurrency = useCallback((value: number): string => {
    return new Intl.NumberFormat("pt-BR", { 
      style: "currency", 
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }, []);

  // Get current month transactions for hover
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const incomeTransactions = allTransactions?.filter(t => {
    const txDate = new Date(t.date);
    return t.type === 'income' && 
           txDate.getMonth() === currentMonth && 
           txDate.getFullYear() === currentYear;
  }).slice(0, 5) || [];

  const expenseTransactions = allTransactions?.filter(t => {
    const txDate = new Date(t.date);
    return t.type === 'expense' && 
           txDate.getMonth() === currentMonth && 
           txDate.getFullYear() === currentYear;
  }).slice(0, 5) || [];

  const renderHoverContent = (transactions: typeof incomeTransactions, type: 'income' | 'expense') => (
    <div className="p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Últimas {type === 'income' ? 'receitas' : 'despesas'}
      </p>
      <ScrollArea className="max-h-48">
        <div className="space-y-1.5">
          {transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma transação</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex justify-between items-center text-xs py-1 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="truncate font-medium">{tx.description || '-'}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {format(new Date(tx.date), "dd/MM", { locale: ptBR })}
                  </p>
                </div>
                <span className={type === 'income' ? 'text-success' : 'text-destructive'}>
                  {formatCurrencyUtil(Number(tx.amount))}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

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

  return (
    <AppLayout title="Home">
      <div className="space-y-3">
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[70px] w-full rounded-lg" />
              <Skeleton className="h-[70px] w-full rounded-lg" />
              <Skeleton className="h-[70px] w-full rounded-lg" />
              <Skeleton className="h-[70px] w-full rounded-lg" />
            </>
          ) : (
            <>
              <StatCard
                title="Saldo Total"
                value={formatCurrency(stats?.totalBalance || 0)}
                icon={<Wallet className="h-4 w-4" />}
                trend={stats?.incomeChange ? { value: Math.abs(stats.incomeChange), isPositive: stats.incomeChange > 0 } : undefined}
              />
              <StatCard
                title="Receitas do Mês"
                value={formatCurrency(stats?.monthlyIncome || 0)}
                icon={<TrendingUp className="h-4 w-4" />}
                variant="success"
                onClick={() => setDetailModal({
                  open: true,
                  type: "income",
                  title: "Receitas do Mês",
                  value: stats?.monthlyIncome || 0,
                })}
                hoverContent={renderHoverContent(incomeTransactions, 'income')}
              />
              <StatCard
                title="Despesas do Mês"
                value={formatCurrency(stats?.monthlyExpenses || 0)}
                icon={<TrendingDown className="h-4 w-4" />}
                variant="destructive"
                onClick={() => setDetailModal({
                  open: true,
                  type: "expense",
                  title: "Despesas do Mês",
                  value: stats?.monthlyExpenses || 0,
                })}
                hoverContent={renderHoverContent(expenseTransactions, 'expense')}
              />
              <StatCard
                title="Economia do Mês"
                value={formatCurrency(stats?.monthlySavings || 0)}
                icon={<PiggyBank className="h-4 w-4" />}
              />
            </>
          )}
        </div>
        
        {/* Budget Alerts */}
        <BudgetAlerts showNotifications={true} />
        
        {/* Monthly Evolution Chart */}
        <MonthlyEvolutionChart />
        
        {/* Strategic Insights - Below Evolution */}
        <StrategicInsightsCard />
        
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentTransactions />
          </div>
          <div className="space-y-3">
            <ReconciliationMetricsCard />
            <ImportCard />
            <BudgetProgress />
          </div>
        </div>
      </div>
      
      {/* AI Assistant Chat - Premium Feature */}
      <AIAssistantChat isPaidUser={false} />

      {/* Transactions Detail Modal */}
      <TransactionsDetailModal
        open={detailModal.open}
        onOpenChange={(open) => setDetailModal(prev => ({ ...prev, open }))}
        type={detailModal.type}
        title={detailModal.title}
        totalValue={detailModal.value}
      />
    </AppLayout>
  );
};

export default Index;
