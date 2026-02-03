import { useNavigate } from "react-router-dom";
import { useEffect, useCallback } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Loader2, RefreshCw } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useDashboardStats();

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
      <AppLayout title="Dashboard">
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
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[120px] w-full rounded-xl" />
              <Skeleton className="h-[120px] w-full rounded-xl" />
              <Skeleton className="h-[120px] w-full rounded-xl" />
              <Skeleton className="h-[120px] w-full rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Saldo Total"
                value={formatCurrency(stats?.totalBalance || 0)}
                icon={<Wallet className="h-5 w-5 md:h-6 md:w-6" />}
                trend={stats?.incomeChange ? { value: Math.abs(stats.incomeChange), isPositive: stats.incomeChange > 0 } : undefined}
              />
              <StatCard
                title="Receitas do Mês"
                value={formatCurrency(stats?.monthlyIncome || 0)}
                icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6" />}
                variant="success"
              />
              <StatCard
                title="Despesas do Mês"
                value={formatCurrency(stats?.monthlyExpenses || 0)}
                icon={<TrendingDown className="h-5 w-5 md:h-6 md:w-6" />}
                variant="destructive"
              />
              <StatCard
                title="Economia do Mês"
                value={formatCurrency(stats?.monthlySavings || 0)}
                icon={<PiggyBank className="h-5 w-5 md:h-6 md:w-6" />}
              />
            </>
          )}
        </div>
        
        {/* Budget Alerts */}
        <BudgetAlerts showNotifications={true} />
        
        {/* Strategic Insights - AI Powered */}
        <StrategicInsightsCard />
        
        {/* Monthly Evolution Chart */}
        <MonthlyEvolutionChart />
        
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentTransactions />
          </div>
          <div className="space-y-6">
            <ReconciliationMetricsCard />
            <ImportCard />
            <BudgetProgress />
          </div>
        </div>
      </div>
      
      {/* AI Assistant Chat - Premium Feature */}
      <AIAssistantChat isPaidUser={false} />
    </AppLayout>
  );
};

export default Index;
