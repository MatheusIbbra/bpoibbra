import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { 
  Activity, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, Building2, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';

export default function OpenFinanceMonitor() {
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const { data: items, refetch: refetchItems } = useQuery({
    queryKey: ['open-finance-items'],
    queryFn: async () => {
      const { data } = await supabase
        .from('open_finance_items')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 30000
  });

  const { data: syncLogs } = useQuery({
    queryKey: ['of-sync-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('open_finance_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 10000
  });

  const metrics = {
    total: items?.length || 0,
    connected: items?.filter(i => i.status === 'completed').length || 0,
    error: items?.filter(i => i.status === 'error').length || 0,
    pending: items?.filter(i => i.status === 'pending' || i.status === 'in_progress').length || 0,
  };

  const successRate = metrics.total > 0
    ? ((metrics.connected / metrics.total) * 100).toFixed(1)
    : '0';

  const triggerSync = async (itemId: string) => {
    try {
      const { error } = await supabase.functions.invoke('pluggy-sync', {
        body: { item_id: itemId, sync_type: 'full' }
      });
      if (error) throw error;
      toast.success('Sincronização iniciada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao sincronizar: ' + error.message);
    }
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    completed: { label: 'Conectado', variant: 'default' },
    pending: { label: 'Pendente', variant: 'outline' },
    in_progress: { label: 'Em Progresso', variant: 'secondary' },
    error: { label: 'Erro', variant: 'destructive' },
    disconnected: { label: 'Desconectado', variant: 'outline' },
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Open Finance Monitor</h1>
            <p className="text-sm text-muted-foreground">Monitoramento em tempo real das conexões</p>
          </div>
          <Button onClick={() => refetchItems()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conectados</p>
                  <p className="text-2xl font-bold">{metrics.connected}</p>
                  <p className="text-xs text-muted-foreground">{successRate}% de sucesso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Com Erro</p>
                  <p className="text-2xl font-bold">{metrics.error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{metrics.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conexões Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Sync</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map(item => {
                  const sc = statusConfig[item.status] || statusConfig.pending;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{item.institution_name}</p>
                            <p className="text-xs text-muted-foreground">{item.institution_type || 'N/A'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.last_sync_at
                          ? new Date(item.last_sync_at).toLocaleString('pt-BR')
                          : 'Nunca'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(item.products) && (item.products as string[]).map((p: string) => (
                            <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(item.consecutive_failures || 0) > 0 ? (
                          <span className="flex items-center gap-1 text-destructive text-sm">
                            <AlertTriangle className="h-3 w-3" />
                            {item.consecutive_failures}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => triggerSync(item.id)}>
                            Sincronizar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedItem(item)}>
                            Detalhes
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!items || items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma conexão Open Finance encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sync Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Sincronizações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {syncLogs?.map(log => (
              <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {log.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                  {log.status !== 'success' && log.status !== 'failed' && <Clock className="h-4 w-4 text-yellow-500" />}
                  <div>
                    <p className="text-sm font-medium">
                      {log.sync_type?.toUpperCase()} — {log.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.started_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{log.records_imported} importados / {log.records_fetched} buscados</span>
                  {log.duration_ms && <span>{(log.duration_ms / 1000).toFixed(1)}s</span>}
                </div>
              </div>
            ))}
            {(!syncLogs || syncLogs.length === 0) && (
              <p className="text-center text-muted-foreground py-4">Nenhum log de sincronização</p>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes da Conexão</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Instituição</p>
                    <p className="font-medium">{selectedItem.institution_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pluggy Item ID</p>
                    <p className="font-mono text-xs">{selectedItem.pluggy_item_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status de Execução</p>
                    <p className="font-medium">{selectedItem.execution_status || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Frequência</p>
                    <p className="font-medium">{selectedItem.sync_frequency || 'daily'}</p>
                  </div>
                  {selectedItem.error_message && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Erro</p>
                      <p className="text-destructive text-sm">{selectedItem.error_message}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="text-sm">{new Date(selectedItem.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Atualizado em</p>
                    <p className="text-sm">{new Date(selectedItem.updated_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>Fechar</Button>
                  <Button onClick={() => { triggerSync(selectedItem.id); setSelectedItem(null); }}>
                    Sincronizar Agora
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
