import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { AIAssistantChat } from "@/components/ai/AIAssistantChat";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { ReconciliationMetricsCard } from "@/components/dashboard/ReconciliationMetricsCard";
import { FinancialHealthCard } from "@/components/dashboard/FinancialHealthCard";
import { CashflowForecastCard } from "@/components/dashboard/CashflowForecastCard";
import { RecurringExpensesCard } from "@/components/dashboard/RecurringExpensesCard";
import { FinancialSimulatorCard } from "@/components/dashboard/FinancialSimulatorCard";

import { ConnectedAccountsSection } from "@/components/dashboard/ConnectedAccountsSection";
import { MultiCurrencyBalanceSection } from "@/components/dashboard/MultiCurrencyBalanceSection";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardHoverTransactions } from "@/components/dashboard/StatCardHoverTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: stats, error } = useDashboardStats();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

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
      </AppLayout>);

  }

  return (
    <AppLayout title="Consolidação Patrimonial">
      <div className="space-y-5">
        {/* Bloco 1: StatCards with colored band on mobile */}
        <div className="relative">
          {/* Colored band behind cards - mobile only, extends from header to bottom of cards */}
          <div className="absolute inset-x-0 -mx-4 bg-[hsl(var(--sidebar-background))] rounded-b-3xl md:hidden" style={{ top: '-4rem', bottom: '-0.75rem' }} />
          
          <div className="relative grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Posição Financeira"
              value={formatCurrency(stats?.totalBalance ?? 0)}
              icon={<Wallet className="h-5 w-5" />}
              variant="default" />

            <StatCard
              title="Entradas Financeiras"
              value={formatCurrency(stats?.monthlyIncome ?? 0)}
              icon={<ArrowUpRight className="h-5 w-5" />}
              variant="success"
              trend={stats?.incomeChange ? { value: stats.incomeChange, isPositive: stats.incomeChange >= 0 } : undefined}
              hoverContent={<StatCardHoverTransactions type="income" />} />

            <StatCard
              title="Saídas Financeiras"
              value={formatCurrency(stats?.monthlyExpenses ?? 0)}
              icon={<ArrowDownRight className="h-5 w-5" />}
              variant="destructive"
              trend={stats?.expenseChange ? { value: stats.expenseChange, isPositive: stats.expenseChange <= 0 } : undefined}
              hoverContent={<StatCardHoverTransactions type="expense" />} />

            <StatCard
              title="Evolução Patrimonial"
              value={formatCurrency(stats?.monthlySavings ?? 0)}
              icon={<TrendingUp className="h-5 w-5" />}
              variant={stats?.monthlySavings && stats.monthlySavings >= 0 ? "success" : "warning"} />

          </div>
        </div>


        {/* Posição Multimoeda */}
        <MultiCurrencyBalanceSection />

        {/* Alertas de Orçamento */}
        <BudgetAlerts showNotifications={true} />

        {/* Distribuição por Categoria + Evolução Financeira */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <CategoryDonutChart />
          <MonthlyEvolutionChart />
        </div>

        {/* Saúde Financeira + Orçamento do Mês */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <FinancialHealthCard />
          <BudgetProgress />
        </div>

        {/* Previsão de Caixa + Despesas Recorrentes */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <CashflowForecastCard />
          <RecurringExpensesCard />
        </div>

        {/* Simulador Financeiro */}
        <FinancialSimulatorCard />

        {/* Últimas Movimentações */}
        <FintechTransactionsList />

        {/* Conciliação */}
        <ReconciliationMetricsCard />

        {/* Contas Conectadas */}
        <ConnectedAccountsSection />
      </div>

      <AIAssistantChat isPaidUser={false} />
    </AppLayout>);

};

export default Index;