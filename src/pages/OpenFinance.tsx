import { AppLayout } from "@/components/layout/AppLayout";
import { BankConnectionsManager } from "@/components/open-finance/BankConnectionsManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  info: <Clock className="h-4 w-4 text-muted-foreground" />,
  success: <CheckCircle2 className="h-4 w-4 text-primary" />,
  warning: <AlertTriangle className="h-4 w-4 text-accent-foreground" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
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

export default function OpenFinance() {
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["integration-logs", orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("integration_logs")
        .select("id, event_type, status, message, created_at, provider")
        .eq("provider", "klavi")
        .order("created_at", { ascending: false })
        .limit(20);

      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IntegrationLog[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <AppLayout title="Open Finance">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Open Finance</h1>
          <p className="text-muted-foreground">
            Conecte suas contas bancárias e importe transações automaticamente via Klavi
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BankConnectionsManager />
          </div>

          <div className="space-y-6">
            {/* Activity Log */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Atividade Recente
                </CardTitle>
                <CardDescription>
                  Últimas ações e eventos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : logs?.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma atividade registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {logs?.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="mt-0.5">
                          {statusIcons[log.status] || statusIcons.info}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {eventLabels[log.event_type] || log.event_type}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.status}
                            </Badge>
                          </div>
                          {log.message && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {log.message}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
