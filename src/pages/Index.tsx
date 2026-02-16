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
import { ConnectedAccountsSection } from "@/components/dashboard/ConnectedAccountsSection";
import { MultiCurrencyBalanceSection } from "@/components/dashboard/MultiCurrencyBalanceSection";
import { PatrimonyEvolutionCard } from "@/components/dashboard/PatrimonyEvolutionCard";
import { AnomalyDetectionCard } from "@/components/dashboard/AnomalyDetectionCard";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardHoverTransactions } from "@/components/dashboard/StatCardHoverTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { StaggerGrid, StaggerItem, AnimatedCard } from "@/components/ui/motion";
import { StatCardSkeleton } from "@/components/ui/premium-skeleton";
import { Loader2, RefreshCw, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: stats, error, isLoading: statsLoading } = useDashboardStats();

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

  return (
    <AppLayout title="Consolidação Patrimonial">
      <div className="space-y-6 max-w-[1400px]">
        {/* 1. Stat Cards — proporção executiva 20:7 */}
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
                    variant="default" />
                </StaggerItem>
                <StaggerItem>
                  <StatCard
                    title="Entradas Financeiras"
                    value={formatCurrency(stats?.monthlyIncome ?? 0)}
                    icon={<ArrowUpRight className="h-5 w-5" />}
                    variant="success"
                    trend={stats?.incomeChange ? { value: stats.incomeChange, isPositive: stats.incomeChange >= 0 } : undefined}
                    hoverContent={<StatCardHoverTransactions type="income" />} />
                </StaggerItem>
                <StaggerItem>
                  <StatCard
                    title="Saídas Financeiras"
                    value={formatCurrency(stats?.monthlyExpenses ?? 0)}
                    icon={<ArrowDownRight className="h-5 w-5" />}
                    variant="destructive"
                    trend={stats?.expenseChange ? { value: stats.expenseChange, isPositive: stats.expenseChange <= 0 } : undefined}
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

        {/* 2. Posição Multimoeda */}
        <AnimatedCard delay={0.15}>
          <MultiCurrencyBalanceSection />
        </AnimatedCard>

        {/* 3. Distribuição por Categoria + Evolução Financeira */}
        <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <StaggerItem><CategoryDonutChart /></StaggerItem>
          <StaggerItem><MonthlyEvolutionChart /></StaggerItem>
        </StaggerGrid>

        {/* 4. Evolução Patrimonial 12M */}
        <AnimatedCard delay={0.1}>
          <PatrimonyEvolutionCard />
        </AnimatedCard>

        {/* 5. Alertas de Orçamento */}
        <AnimatedCard delay={0.1}>
          <BudgetAlerts showNotifications={true} />
        </AnimatedCard>

        {/* 6. Orçamento do Mês + Últimas Movimentações */}
        <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <StaggerItem><BudgetProgress /></StaggerItem>
          <StaggerItem><FintechTransactionsList /></StaggerItem>
        </StaggerGrid>

        {/* 7. Detecção de Anomalias */}
        <AnimatedCard delay={0.1}>
          <AnomalyDetectionCard />
        </AnimatedCard>

        {/* 8. Conciliação */}
        <AnimatedCard delay={0.05}>
          <ReconciliationMetricsCard />
        </AnimatedCard>

        {/* 9. Contas Conectadas */}
        <AnimatedCard delay={0.05}>
          <ConnectedAccountsSection />
        </AnimatedCard>
      </div>

      <AIAssistantChat isPaidUser={false} />
    </AppLayout>
  );
};

export default Index;
