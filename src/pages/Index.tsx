import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConnectedAccountsSection } from "@/components/dashboard/ConnectedAccountsSection";
import { ConsolidatedBalanceSection } from "@/components/dashboard/ConsolidatedBalanceSection";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { AIAssistantChat } from "@/components/ai/AIAssistantChat";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { ReconciliationMetricsCard } from "@/components/dashboard/ReconciliationMetricsCard";
import { StrategicInsightsCard } from "@/components/dashboard/StrategicInsightsCard";
import { ImportCard } from "@/components/import/ImportCard";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { error } = useDashboardStats();

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
    <AppLayout title="Home">
      <div className="space-y-3">
        {/* Bloco 1: Saldo Consolidado / Patrimônio */}
        <ConsolidatedBalanceSection />

        {/* Alertas de Orçamento */}
        <BudgetAlerts showNotifications={true} />

        {/* Bloco 2: Movimentações + Gráficos */}
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FintechTransactionsList />
          </div>
          <div className="lg:col-span-1">
            <CategoryDonutChart />
          </div>
        </div>

        {/* Evolução Mensal */}
        <MonthlyEvolutionChart />

        {/* Insights Estratégicos */}
        <StrategicInsightsCard />

        {/* Cards menores */}
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <ReconciliationMetricsCard />
          <ImportCard />
          <BudgetProgress />
        </div>

        {/* Contas Conectadas (Open Finance) */}
        <ConnectedAccountsSection />
      </div>

      <AIAssistantChat isPaidUser={false} />
    </AppLayout>
  );
};

export default Index;
