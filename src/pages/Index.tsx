import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConnectedAccountsSection } from "@/components/dashboard/ConnectedAccountsSection";
import { CreditCardsAdvancedSummary } from "@/components/dashboard/CreditCardsAdvancedSummary";
import { FintechTransactionsList } from "@/components/dashboard/FintechTransactionsList";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { AIAssistantChat } from "@/components/ai/AIAssistantChat";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { CategoryDonutChart } from "@/components/dashboard/CategoryDonutChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { ReconciliationMetricsCard } from "@/components/dashboard/ReconciliationMetricsCard";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardHoverTransactions } from "@/components/dashboard/StatCardHoverTransactions";
import { CreditCardSummary } from "@/components/dashboard/CreditCardSummary";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wallet, ArrowUpRight, ArrowDownRight, PiggyBank } from "lucide-react";

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
      <div className="space-y-5">
        {/* Bloco 1: StatCards — Saldo, Receitas, Despesas, Economia */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Saldo Disponível"
            value={formatCurrency(stats?.totalBalance ?? 0)}
            icon={<Wallet className="h-5 w-5" />}
            variant="default"
          />
          <StatCard
            title="Receitas do Mês"
            value={formatCurrency(stats?.monthlyIncome ?? 0)}
            icon={<ArrowUpRight className="h-5 w-5" />}
            variant="success"
            trend={stats?.incomeChange ? { value: stats.incomeChange, isPositive: stats.incomeChange >= 0 } : undefined}
            hoverContent={<StatCardHoverTransactions type="income" />}
          />
          <StatCard
            title="Despesas do Mês"
            value={formatCurrency(stats?.monthlyExpenses ?? 0)}
            icon={<ArrowDownRight className="h-5 w-5" />}
            variant="destructive"
            trend={stats?.expenseChange ? { value: stats.expenseChange, isPositive: stats.expenseChange <= 0 } : undefined}
            hoverContent={<StatCardHoverTransactions type="expense" />}
          />
          <StatCard
            title="Economia do Mês"
            value={formatCurrency(stats?.monthlySavings ?? 0)}
            icon={<PiggyBank className="h-5 w-5" />}
            variant={stats?.monthlySavings && stats.monthlySavings >= 0 ? "success" : "warning"}
          />
        </div>

        {/* Alertas de Orçamento */}
        <BudgetAlerts showNotifications={true} />

        {/* Distribuição por Categoria + Evolução Financeira lado a lado */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <CategoryDonutChart />
          <MonthlyEvolutionChart />
        </div>

        {/* Últimas Movimentações */}
        <FintechTransactionsList />

        {/* Cards menores */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <ReconciliationMetricsCard />
          <BudgetProgress />
        </div>

        {/* Contas Conectadas (Open Finance) */}
        <ConnectedAccountsSection />

        {/* Visão Consolidada Avançada de Cartões de Crédito */}
        <CreditCardsAdvancedSummary />

        {/* Cartões de Crédito (resumo existente) */}
        <CreditCardSummary />
      </div>

      <AIAssistantChat isPaidUser={false} />
    </AppLayout>
  );
};

export default Index;
