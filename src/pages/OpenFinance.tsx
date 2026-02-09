import { AppLayout } from "@/components/layout/AppLayout";
import { BankConnectionsManager } from "@/components/open-finance/BankConnectionsManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ScrollText 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface IntegrationLog {
  id: string;
  event_type: string;
  status: string;
  message: string | null;
  created_at: string;
  provider: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  info: <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4 text-accent-foreground" aria-hidden="true" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />,
};

const eventLabels: Record<string, string> = {
  oauth_start: "Início OAuth",
  oauth_callback: "Callback OAuth",
  token_exchange: "Troca de Tokens",
  token_refresh: "Refresh Token",
  sync: "Sincronização",
  webhook: "Webhook",
  disconnect: "Desconexão",
  error: "Erro",
};

const formatLogDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (!isValid(date)) {
      return "Data inválida";
    }
    return format(date, "dd/MM HH:mm", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
};

const ErrorState = ({ message }: { message: string }) => (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{message}</AlertDescription>
  </Alert>
);

const LoadingState = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
);

const EmptyState = () => (
  <div className="text-center py-6 text-muted-foreground">
    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
    <p className="text-sm">Nenhuma atividade registrada</p>
  </div>
);

const LogItem = ({ log }: { log: IntegrationLog }) => (
  <div 
    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
    role="article"
    aria-label={`Log de ${eventLabels[log.event_type] || log.event_type}`}
  >
    <div className="mt-0.5" aria-label={`Status: ${log.status}`}>
      {statusIcons[log.status] || statusIcons.info}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">
          {eventLabels[log.event_type] || log.event_type}
        </span>
        <Badge variant="outline" className="text-xs">
          {log.status}
        </Badge>
      </div>
      {log.message && (
        <p className="text-xs text-muted-foreground truncate mt-0.5" title={log.message}>
          {log.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        <time dateTime={log.created_at}>
          {formatLogDate(log.created_at)}
        </time>
      </p>
    </div>
  </div>
);

export default function OpenFinance() {
  const { getOrganizationFilter } = useBaseFilter();
  const { isAdmin } = useIsAdmin();
  const orgFilter = getOrganizationFilter();

  // Memoiza a queryKey para evitar recriações desnecessárias
  const queryKey = useMemo(
    () => ["integration-logs", orgFilter.type, orgFilter.ids] as const,
    [orgFilter.type, orgFilter.ids]
  );

  const { 
    data: logs, 
    isLoading: logsLoading, 
    error: logsError 
  } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("integration_logs")
        .select("id, event_type, status, message, created_at, provider")
        .order("created_at", { ascending: false })
        .limit(20);

      if (orgFilter.type === 'single' && orgFilter.ids[0]) {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as IntegrationLog[]) || [];
    },
    refetchInterval: 30000, // Refresh a cada 30 segundos
    staleTime: 25000, // Considera dados "frescos" por 25s
    retry: 2, // Tenta 2x em caso de erro
    retryDelay: 1000, // Aguarda 1s entre tentativas
  });

  return (
    <AppLayout title="Open Finance">
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">Open Finance</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Conecte suas contas bancárias e importe transações automaticamente
          </p>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BankConnectionsManager />
          </div>

          <div className="space-y-4 md:space-y-6">
            {/* Activity Log - Admin only */}
            {isAdmin && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" aria-hidden="true" />
                    <span>Atividade Recente</span>
                  </CardTitle>
                  <CardDescription>
                    Últimas ações e eventos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {logsError ? (
                    <ErrorState message="Erro ao carregar os logs. Tente novamente." />
                  ) : logsLoading ? (
                    <LoadingState />
                  ) : !logs || logs.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div 
                      className="space-y-3 max-h-[400px] overflow-y-auto overscroll-contain"
                      role="feed"
                      aria-label="Feed de atividades recentes"
                    >
                      {logs.map((log) => (
                        <LogItem key={log.id} log={log} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sobre o Open Finance</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  O Open Finance permite importar automaticamente suas transações 
                  bancárias de forma segura e regulamentada pelo Banco Central.
                </p>
                <p>
                  Ao conectar um banco, você autoriza o acesso apenas para leitura 
                  das suas transações. Nenhuma operação financeira é realizada.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
