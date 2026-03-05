import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, AlertTriangle, XCircle, Activity,
  Brain, RefreshCw, Clock, Zap, Database, TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type HealthStatus = "ok" | "warning" | "error" | "unknown";

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Activity className="h-4 w-4 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const map: Record<HealthStatus, { label: string; className: string }> = {
    ok: { label: "Operacional", className: "bg-success/10 text-success border-success/20" },
    warning: { label: "Atenção", className: "bg-warning/10 text-warning border-warning/20" },
    error: { label: "Falha", className: "bg-destructive/10 text-destructive border-destructive/20" },
    unknown: { label: "Desconhecido", className: "bg-muted/40 text-muted-foreground border-muted/30" },
  };
  const { label, className } = map[status];
  return <Badge className={`text-[10px] border ${className}`}>{label}</Badge>;
}

function MetricCard({
  title, value, sub, icon: Icon, status,
}: { title: string; value: string | number; sub?: string; icon: React.ElementType; status?: HealthStatus }) {
  return (
    <Card className="border-0 shadow-fintech">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" strokeWidth={1.7} />
          </div>
          {status && <StatusBadge status={status} />}
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const EDGE_FUNCTIONS = [
  "ai-chat", "background-jobs", "check-cpf-duplicate", "check-plan-limits",
  "classify-transaction", "classify-transactions", "create-checkout-session",
  "delete-client", "delete-user", "financial-core-engine", "generate-ai-analysis",
  "generate-ai-insights", "get-user-emails", "klavi-authorize", "klavi-sync",
  "pluggy-connect", "pluggy-sync", "pluggy-webhook", "process-import",
];

export default function AdminHealth() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: rolesLoading } = useIsAdmin();

  useEffect(() => {
    if (!rolesLoading && !userRoles?.includes("admin")) {
      navigate("/");
    }
  }, [userRoles, rolesLoading, navigate]);

  const { data: aiMetrics, isLoading: aiLoading } = useQuery({
    queryKey: ["health-ai-metrics"],
    queryFn: async () => {
      const since = subDays(new Date(), 1).toISOString();
      const { data: usageLogs } = await supabase
        .from("api_usage_logs")
        .select("endpoint, created_at, tokens_used")
        .ilike("endpoint", "%classify%")
        .gte("created_at", since);

      const { data: aiSuggestions } = await supabase
        .from("ai_suggestions")
        .select("was_accepted, created_at, model_version")
        .gte("created_at", since);

      const total = aiSuggestions?.length ?? 0;
      const accepted = aiSuggestions?.filter(s => s.was_accepted === true).length ?? 0;
      const rejected = aiSuggestions?.filter(s => s.was_accepted === false).length ?? 0;
      const pending = total - accepted - rejected;
      const approvalRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
      const totalTokens = usageLogs?.reduce((s, l) => s + (l.tokens_used ?? 0), 0) ?? 0;
      // Estimate cost: Gemini Flash ~$0.075/1M tokens
      const estimatedCost = (totalTokens / 1_000_000) * 0.075;

      return { total, accepted, rejected, pending, approvalRate, totalTokens, estimatedCost };
    },
    staleTime: 60_000,
  });

  const { data: openFinanceMetrics, isLoading: ofLoading } = useQuery({
    queryKey: ["health-open-finance"],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("open_finance_items")
        .select("id, institution_name, organization_id, status, last_sync_at, next_sync_at, error_message, consecutive_failures");

      const { data: syncLogs } = await supabase
        .from("open_finance_sync_logs")
        .select("status, records_imported, error_message, started_at, completed_at")
        .gte("started_at", subDays(new Date(), 1).toISOString())
        .order("started_at", { ascending: false })
        .limit(50);

      const totalItems = items?.length ?? 0;
      const activeItems = items?.filter(i => i.status === "active").length ?? 0;
      const errorItems = items?.filter(i => (i.consecutive_failures ?? 0) > 0).length ?? 0;
      const totalSyncs = syncLogs?.length ?? 0;
      const failedSyncs = syncLogs?.filter(l => l.status === "error").length ?? 0;
      const totalImported = syncLogs?.reduce((s, l) => s + (l.records_imported ?? 0), 0) ?? 0;

      return { totalItems, activeItems, errorItems, totalSyncs, failedSyncs, totalImported, items: items ?? [] };
    },
    staleTime: 60_000,
  });

  const { data: edgeFunctionLogs, isLoading: efLoading } = useQuery({
    queryKey: ["health-edge-logs"],
    queryFn: async () => {
      const since = subDays(new Date(), 1).toISOString();
      const { data: logs } = await supabase
        .from("api_usage_logs")
        .select("endpoint, created_at")
        .gte("created_at", since);

      // Aggregate per function
      const map: Record<string, { calls: number; lastCall: string | null }> = {};
      for (const fn of EDGE_FUNCTIONS) {
        map[fn] = { calls: 0, lastCall: null };
      }
      for (const log of logs ?? []) {
        const fn = log.endpoint.replace("analytics:", "").split(":")[0];
        if (map[fn]) {
          map[fn].calls++;
          if (!map[fn].lastCall || log.created_at > map[fn].lastCall!) {
            map[fn].lastCall = log.created_at;
          }
        }
      }
      return map;
    },
    staleTime: 60_000,
  });

  if (rolesLoading) {
    return (
      <AppLayout title="Health Dashboard">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const overallStatus: HealthStatus =
    (openFinanceMetrics?.errorItems ?? 0) > 0 ? "warning" :
    (openFinanceMetrics?.failedSyncs ?? 0) > 0 ? "warning" : "ok";

  return (
    <AppLayout title="Health Dashboard">
      <div className="space-y-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Sistema de Saúde
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitoramento em tempo real — últimas 24h
            </p>
          </div>
          <StatusBadge status={overallStatus} />
        </div>

        {/* ── AI Metrics ── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4" /> IA Generativa
          </h2>
          {aiLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Classificações (24h)"
                value={aiMetrics?.total ?? 0}
                icon={Brain}
                status={aiMetrics && aiMetrics.total > 0 ? "ok" : "unknown"}
              />
              <MetricCard
                title="Taxa de Aprovação"
                value={`${aiMetrics?.approvalRate ?? 0}%`}
                sub={`${aiMetrics?.accepted ?? 0} aceitas / ${aiMetrics?.rejected ?? 0} rejeitadas`}
                icon={TrendingUp}
                status={
                  (aiMetrics?.approvalRate ?? 0) >= 70 ? "ok" :
                  (aiMetrics?.approvalRate ?? 0) >= 50 ? "warning" : "error"
                }
              />
              <MetricCard
                title="Tokens Consumidos"
                value={(aiMetrics?.totalTokens ?? 0).toLocaleString("pt-BR")}
                sub="últimas 24h"
                icon={Zap}
                status="ok"
              />
              <MetricCard
                title="Custo Estimado"
                value={`$${(aiMetrics?.estimatedCost ?? 0).toFixed(4)}`}
                sub="Gemini Flash 1.5"
                icon={Database}
                status="ok"
              />
            </div>
          )}
        </section>

        {/* ── Open Finance ── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Open Finance
          </h2>
          {ofLoading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <MetricCard title="Conexões Ativas" value={openFinanceMetrics?.activeItems ?? 0} icon={CheckCircle2} status="ok" />
                <MetricCard title="Com Falhas" value={openFinanceMetrics?.errorItems ?? 0} icon={AlertTriangle}
                  status={(openFinanceMetrics?.errorItems ?? 0) > 0 ? "warning" : "ok"} />
                <MetricCard title="Sincronizações (24h)" value={openFinanceMetrics?.totalSyncs ?? 0} icon={RefreshCw} status="ok" />
                <MetricCard title="Transações Importadas" value={(openFinanceMetrics?.totalImported ?? 0).toLocaleString("pt-BR")} icon={Database} status="ok" />
              </div>

              {/* Connections table */}
              <Card className="border-0 shadow-fintech">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conexões por Organização</CardTitle>
                </CardHeader>
                <CardContent>
                  {(openFinanceMetrics?.items.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conexão registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {openFinanceMetrics?.items.map((item) => {
                        const failures = item.consecutive_failures ?? 0;
                        const st: HealthStatus = failures > 3 ? "error" : failures > 0 ? "warning" : "ok";
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/10 border border-border/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <StatusIcon status={st} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{item.institution_name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.last_sync_at
                                    ? `Última sync: ${format(new Date(item.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}`
                                    : "Nunca sincronizado"}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={st} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>

        {/* ── Edge Functions ── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4" /> Edge Functions ({EDGE_FUNCTIONS.length})
          </h2>
          {efLoading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <Card className="border-0 shadow-fintech">
              <CardContent className="p-0">
                <div className="divide-y divide-border/10">
                  {EDGE_FUNCTIONS.map((fn) => {
                    const stats = edgeFunctionLogs?.[fn];
                    const calls = stats?.calls ?? 0;
                    const lastCall = stats?.lastCall;
                    const st: HealthStatus = lastCall ? "ok" : "unknown";
                    return (
                      <div key={fn} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/5 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusIcon status={st} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground font-mono">{fn}</p>
                            {lastCall && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {format(new Date(lastCall), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">{calls} calls</span>
                          <StatusBadge status={st} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
