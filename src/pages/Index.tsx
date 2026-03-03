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
import { AnimatedCard } from "@/components/ui/motion";
import { StatCardSkeleton } from "@/components/ui/premium-skeleton";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import {
  Loader2, RefreshCw, Wallet, ArrowUpRight, ArrowDownRight,
  TrendingUp, Building2, ChevronDown, ChevronUp, CalendarDays,
  Target, AlertTriangle, BarChart3, Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBaseFilter, useBaseFilterState, useBaseFilterActions } from "@/contexts/BaseFilterContext";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useQuery } from "@tanstack/react-query";
import { WelcomeModal } from "@/components/dashboard/WelcomeModal";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

// ── Paleta institucional IBBRA ──
const BRAND_DEEP = "hsl(var(--brand-deep))";      // #011E41
const BRAND_HL   = "hsl(var(--brand-highlight))"; // #005CB9

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
            <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Configurando sua plataforma
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos preparando seu ambiente patrimonial personalizado.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>Finalizando configuração...</span>
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
      <AppLayout title="Posição Patrimonial">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <div className="text-center space-y-4">
            <div className="text-destructive text-lg font-medium">Erro ao carregar dados</div>
            <p className="text-muted-foreground">Não foi possível carregar as informações patrimoniais.</p>
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

  // Strategic indicator
  const savings = stats?.monthlySavings ?? 0;
  const strategicStatus = savings > 0
    ? { label: "Crescimento", color: "text-success" }
    : savings < 0
    ? { label: "Atenção", color: "text-destructive" }
    : { label: "Estável", color: "text-muted-foreground" };

  return (
    <AppLayout title="Posição Patrimonial">
      <WelcomeModal />
      <div className="space-y-5 w-full">

        {/* ══════════════════════════════════════════
            BLOCO 1 — POSIÇÃO PATRIMONIAL
            Painel institucional azul profundo
            ══════════════════════════════════════════ */}
        <div className="-mx-5 md:mx-0 md:rounded-[20px] overflow-hidden relative"
          style={{ backgroundColor: BRAND_DEEP }}
        >
          {/* Guilloche texture — 3% opacity */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "url('/ibbra-grafismo.svg')",
              backgroundRepeat: "repeat",
              backgroundSize: "260px",
              backgroundPosition: "center",
              opacity: 0.03,
            }}
          />

          <div className="relative px-5 pt-6 pb-6 md:px-10 md:pt-8 md:pb-8">
            {/* Top row: institutional label + month selector */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] font-semibold mb-0.5"
                  style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  IBBRA · POSIÇÃO ESTRATÉGICA
                </p>
                <p className="text-[9px] italic"
                  style={{ color: "rgba(255,255,255,0.18)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Acompanhamento patrimonial consolidado
                </p>
              </div>
              <div className="rounded-full border px-3 py-1 flex items-center"
                style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" }}>
                <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} variant="overlay-mobile" />
              </div>
            </div>

            {/* ── Patrimônio Consolidado — valor principal ── */}
            {statsLoading ? (
              <div className="mb-6"><StatCardSkeleton /></div>
            ) : (
              <button
                className="w-full text-left mb-6 group"
                onClick={() => setShowAccountsDialog(true)}
              >
                <p className="text-[8px] uppercase tracking-[0.22em] font-semibold mb-3"
                  style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Patrimônio Consolidado
                </p>
                <p
                  className="font-light text-white leading-none mb-3 group-hover:opacity-90 transition-opacity"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    letterSpacing: "-0.025em",
                    fontSize: "clamp(2.2rem, 10vw, 3.5rem)",
                  }}
                >
                  <MaskedValue>{formatCurrency(stats?.totalBalance ?? 0)}</MaskedValue>
                </p>

                {/* Strategic indicator row */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wide"
                      style={{
                        backgroundColor: savings >= 0 ? "rgba(34,197,94,0.15)" : "rgba(255,70,20,0.15)",
                        color: savings >= 0 ? "rgb(134,239,172)" : "rgb(252,165,165)",
                        border: `1px solid ${savings >= 0 ? "rgba(34,197,94,0.2)" : "rgba(255,70,20,0.2)"}`,
                      }}>
                      {strategicStatus.label}
                    </span>
                  </div>
                  <p className="text-[9px] uppercase tracking-[0.1em]"
                    style={{ color: "rgba(255,255,255,0.22)" }}>
                    Toque para detalhar contas
                  </p>
                </div>
              </button>
            )}

            {/* ── Separador institucional ── */}
            <div className="mb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

            {/* ── Métricas secundárias: Evolução · Receitas · Despesas ── */}
            <div className="grid grid-cols-3 gap-3">
              {statsLoading ? (
                <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
              ) : (
                <>
                  {/* Evolução */}
                  <div className="rounded-[10px] px-3 py-3"
                    style={{
                      backgroundColor: savings < 0 ? "rgba(255,70,20,0.1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${savings < 0 ? "rgba(255,70,20,0.2)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <p className="text-[7px] uppercase tracking-[0.16em] mb-2 font-semibold"
                      style={{ color: "rgba(255,255,255,0.28)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Evolução
                    </p>
                    <p className="font-light leading-none"
                      style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "clamp(0.75rem, 3.5vw, 0.9rem)",
                        color: savings < 0 ? "rgb(252,165,165)" : "rgba(255,255,255,0.9)",
                      }}>
                      <MaskedValue>{formatCurrency(savings)}</MaskedValue>
                    </p>
                  </div>

                  {/* Receitas Operacionais */}
                  <button
                    className="rounded-[10px] px-3 py-3 text-left transition-all"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onClick={() => setShowIncomeDialog(true)}
                  >
                    <p className="text-[7px] uppercase tracking-[0.16em] mb-2 font-semibold"
                      style={{ color: "rgba(255,255,255,0.28)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Receitas
                    </p>
                    <p className="font-light text-white leading-none"
                      style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "clamp(0.75rem, 3.5vw, 0.9rem)",
                      }}>
                      <MaskedValue>{formatCurrency(stats?.monthlyIncome ?? 0)}</MaskedValue>
                    </p>
                    {stats?.incomeChange !== undefined && (
                      <p className="text-[7px] mt-1.5 font-semibold"
                        style={{ color: stats.incomeChange >= 0 ? "rgb(134,239,172)" : "rgb(252,165,165)" }}>
                        {stats.incomeChange >= 0 ? "▲" : "▼"} {Math.abs(stats.incomeChange).toFixed(1)}%
                      </p>
                    )}
                  </button>

                  {/* Despesas Operacionais */}
                  <button
                    className="rounded-[10px] px-3 py-3 text-left transition-all"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onClick={() => setShowExpenseDialog(true)}
                  >
                    <p className="text-[7px] uppercase tracking-[0.16em] mb-2 font-semibold"
                      style={{ color: "rgba(255,255,255,0.28)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Despesas
                    </p>
                    <p className="font-light text-white leading-none"
                      style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "clamp(0.75rem, 3.5vw, 0.9rem)",
                      }}>
                      <MaskedValue>{formatCurrency(stats?.monthlyExpenses ?? 0)}</MaskedValue>
                    </p>
                    {stats?.expenseChange !== undefined && (
                      <p className="text-[7px] mt-1.5 font-semibold"
                        style={{ color: stats.expenseChange <= 0 ? "rgb(134,239,172)" : "rgb(252,165,165)" }}>
                        {stats.expenseChange <= 0 ? "▼" : "▲"} {Math.abs(stats.expenseChange).toFixed(1)}%
                      </p>
                    )}
                  </button>
                </>
              )}
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
          title="Receitas Operacionais do Período"
          transactions={monthTransactions.filter(t => t.type === "income").sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())}
          variant="success"
          onEditTransaction={(tx) => { setEditingTransaction(tx); setEditDialogOpen(true); }}
        />

        <TransactionsListDialog
          open={showExpenseDialog}
          onOpenChange={setShowExpenseDialog}
          title="Despesas Operacionais do Período"
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

        {/* ══════════════════════════════════════════
            LAYOUT PRINCIPAL — grid institucional
            ══════════════════════════════════════════ */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_300px]">

          {/* ── Coluna esquerda ── */}
          <div className="space-y-5 min-w-0">

            {/* BLOCO MOBILE — Acompanhamento Estratégico */}
            <div className="block lg:hidden">
              <AnimatedCard delay={0.05}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-5">
                    <div>
                      <CardTitle className="text-sm font-semibold tracking-tight"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Acompanhamento Estratégico
                      </CardTitle>
                      <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                        Planejamento e correções mensais
                      </p>
                    </div>
                    <Link to="/orcamentos">
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-xs">Ver plano</Badge>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5 pb-5">
                    <InteractiveBudgetList selectedMonth={selectedMonth} />
                    <BudgetAlerts showNotifications={true} compact selectedMonth={selectedMonth} />
                    <UnclassifiedTransactionsAlert />
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>

            {/* Posição Multimoeda */}
            <AnimatedCard delay={0.1}>
              <MultiCurrencyBalanceSection />
            </AnimatedCard>

            {/* ══ BLOCO 2: Evolução + Distribuição ══ */}
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <AnimatedCard delay={0.15}>
                <Card>
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      Evolução Patrimonial
                    </CardTitle>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      Tendência mensal consolidada
                    </p>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <MonthlyEvolutionChart selectedMonthFilter={selectedMonth} />
                  </CardContent>
                </Card>
              </AnimatedCard>
              <AnimatedCard delay={0.2}>
                <Card>
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      Distribuição Estratégica
                    </CardTitle>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      Alocação por categoria
                    </p>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <CategoryDonutChart selectedMonth={selectedMonth} />
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>
          </div>

          {/* ── Coluna direita — desktop only ── */}
          <div className="hidden lg:flex flex-col gap-5">
            <div className="sticky top-4 space-y-5">

              {/* Acompanhamento Estratégico */}
              <AnimatedCard delay={0.1}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-5">
                    <div>
                      <CardTitle className="text-sm font-semibold"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Acompanhamento Estratégico
                      </CardTitle>
                      <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                        Monitoramento e correções mensais
                      </p>
                    </div>
                    <Link to="/orcamentos">
                      <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-[10px]">Ver plano</Badge>
                    </Link>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-4">
                    <InteractiveBudgetList selectedMonth={selectedMonth} />
                    <div className="border-t pt-3">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alertas</p>
                      <BudgetAlerts showNotifications={false} compact selectedMonth={selectedMonth} />
                    </div>
                    <UnclassifiedTransactionsAlert />
                  </CardContent>
                </Card>
              </AnimatedCard>

              {/* Centro de Decisão Estratégica */}
              <AnimatedCard delay={0.18}>
                <Card>
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      Centro de Decisão
                    </CardTitle>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      Ações estratégicas rápidas
                    </p>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { label: "Nova Receita", icon: ArrowUpRight, href: "/receitas" },
                        { label: "Nova Despesa", icon: ArrowDownRight, href: "/despesas" },
                        { label: "Planejamento", icon: Target, href: "/orcamentos" },
                        { label: "Relatórios", icon: BarChart3, href: "/relatorios" },
                      ] as const).map((item) => (
                        <Link key={item.label} to={item.href}>
                          <button className="w-full flex flex-col items-center gap-2 p-3 rounded-xl border border-border/30 bg-secondary/30 hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 text-center group">
                            <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
                            <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                              {item.label}
                            </span>
                          </button>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            BLOCO 3 — MONITORAMENTO OPERACIONAL
            ══════════════════════════════════════════ */}
        <AnimatedCard delay={0.08}>
          <Card>
            <CardHeader className="pb-1 pt-4 px-5">
              <CardTitle className="text-sm font-semibold"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Monitoramento Operacional
              </CardTitle>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                Movimentações recentes do período selecionado
              </p>
            </CardHeader>
          </Card>
          <FintechTransactionsList selectedMonth={selectedMonth} />
        </AnimatedCard>

        {/* ══════════════════════════════════════════
            MOBILE — Centro de Decisão
            ══════════════════════════════════════════ */}
        <div className="block lg:hidden">
          <AnimatedCard delay={0.12}>
            <Card>
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-sm font-semibold"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Centro de Decisão
                </CardTitle>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                  Ações estratégicas rápidas
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { label: "Nova Receita", icon: ArrowUpRight, href: "/receitas" },
                    { label: "Nova Despesa", icon: ArrowDownRight, href: "/despesas" },
                    { label: "Planejamento", icon: Target, href: "/orcamentos" },
                    { label: "Relatórios", icon: BarChart3, href: "/relatorios" },
                  ] as const).map((item) => (
                    <Link key={item.label} to={item.href}>
                      <button className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/30 bg-secondary/20 hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 group">
                        <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" strokeWidth={1.5} />
                        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          {item.label}
                        </span>
                      </button>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </div>

      </div>
    </AppLayout>
  );
};

// ── Interactive Budget List ──
function InteractiveBudgetList({ selectedMonth }: { selectedMonth?: Date } = {}) {
  const { requiresBaseSelection } = useBaseFilter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refDate = selectedMonth || new Date();
  const startDate = format(startOfMonth(refDate), "yyyy-MM-dd");
  const endDate = format(endOfMonth(refDate), "yyyy-MM-dd");

  const { data: budgets, isLoading: budgetsLoading } = useBudgets();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    type: "expense", startDate, endDate,
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

        let exceededDate: string | null = null;
        if (isOverBudget && budget.txDates.length > 0) {
          const txsByDate = transactions?.filter(tx => tx.category_id === budget.category_id)
            .sort((a, b) => a.date.localeCompare(b.date)) || [];
          let runningTotal = 0;
          for (const tx of txsByDate) {
            runningTotal += tx.amount;
            if (runningTotal > budget.amount) { exceededDate = tx.date; break; }
          }
        }

        return (
          <div key={budget.id}>
            <button
              className={cn("w-full text-left px-2 py-2 rounded-lg transition-colors hover:bg-muted/50", isExpanded && "bg-muted/40")}
              onClick={() => setExpandedId(prev => prev === budget.id ? null : budget.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md text-primary-foreground text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: budget.categories?.color || "#6366f1" }}>
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
                      <p className="text-[10px] text-muted-foreground">Limite excedido</p>
                      <p className="text-xs font-semibold text-destructive">{formatCurrency(Math.abs(remaining))} acima</p>
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
      default: return 'Conta';
    }
  };

  return (
    <div className="p-2 space-y-1">
      {accounts.map((acc) => (
        <div key={acc.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: acc.color || "#3b82f6" }}>
              <Building2 className="h-3 w-3 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{shortenAccountName(acc.name, acc.account_type)}</p>
              <p className="text-[10px] text-muted-foreground truncate">{acc.bank_name || typeLabel(acc.account_type)}</p>
            </div>
          </div>
          <span className={cn("text-xs font-semibold tabular-nums shrink-0",
            (acc.current_balance || 0) >= 0 ? "text-success" : "text-destructive")}>
            {formatCurrency(acc.current_balance || 0)}
          </span>
        </div>
      ))}
      <div className="border-t pt-1.5 mt-1.5 flex items-center justify-between px-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Patrimônio Total</span>
        <span className="text-xs font-bold tabular-nums">
          {formatCurrency(accounts.reduce((s, a) => s + (a.current_balance || 0), 0))}
        </span>
      </div>
    </div>
  );
}

// ── Transactions list modal ──
function TransactionsListDialog({
  open, onOpenChange, title, transactions, variant, onEditTransaction,
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
            <p className="text-xs text-muted-foreground text-center py-6">Sem movimentações no período</p>
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
