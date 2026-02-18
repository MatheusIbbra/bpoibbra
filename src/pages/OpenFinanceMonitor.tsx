import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { 
  Activity, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const HOURS_24 = 24 * 60 * 60 * 1000;

export default function OpenFinanceMonitor() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: items, refetch: refetchItems } = useQuery({
    queryKey: ['open-finance-items'],
    queryFn: async () => {
      const { data } = await supabase
        .from('open_finance_items')
        .select('*')
        .neq('status', 'disconnected')
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 30000
  });

  const { data: syncLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['of-sync-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('open_finance_sync_logs')
        .select('*, open_finance_items!open_finance_sync_logs_item_id_fkey(institution_name, status)')
        .order('created_at', { ascending: false })
        .limit(100);
      // Filter out logs from disconnected items
      return (data || []).filter((log: any) => 
        !log.open_finance_items || log.open_finance_items.status !== 'disconnected'
      );
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

  // Items not synced in 24h+
  const staleItems = items?.filter(i => {
    if (!i.last_sync_at) return true;
    return Date.now() - new Date(i.last_sync_at).getTime() > HOURS_24;
  }) || [];

  const triggerSync = async (itemId: string) => {
    setSyncingItemId(itemId);
    try {
      const item = items?.find(i => i.id === itemId);
      if (!item) throw new Error('Item não encontrado');
      const { error } = await supabase.functions.invoke('pluggy-sync', {
        body: { 
          organization_id: item.organization_id, 
          item_id: item.pluggy_item_id 
        }
      });
      if (error) throw error;
      toast.success('Sincronização iniciada com sucesso!');
      await Promise.all([refetchItems(), refetchLogs()]);
    } catch (error: any) {
      toast.error('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    completed: { label: 'Conectado', variant: 'default' },
    pending: { label: 'Pendente', variant: 'outline' },
    in_progress: { label: 'Em Progresso', variant: 'secondary' },
    error: { label: 'Erro', variant: 'destructive' },
    disconnected: { label: 'Desconectado', variant: 'outline' },
  };

  const getElapsedText = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca sincronizado';
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  };

  const isStale = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return true;
    return Date.now() - new Date(lastSyncAt).getTime() > HOURS_24;
  };

  // Get logs for a specific item
  const getItemLogs = (itemId: string) => {
    return (syncLogs || [])
      .filter((log: any) => log.item_id === itemId)
      .slice(0, 10);
  };

  const selectedItem = items?.find(i => i.id === selectedItemId);
  const selectedItemLogs = selectedItemId ? getItemLogs(selectedItemId) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Open Finance Monitor</h1>
            <p className="text-sm text-muted-foreground">Monitoramento em tempo real das conexões</p>
          </div>
          <Button 
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await Promise.all([refetchItems(), refetchLogs()]);
                toast.success('Dados atualizados!');
              } catch {
                toast.error('Erro ao atualizar dados');
              } finally {
                setIsRefreshing(false);
              }
            }} 
            variant="outline" 
            size="sm"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stale alert */}
        {staleItems.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Conexões desatualizadas</AlertTitle>
            <AlertDescription>
              {staleItems.length} conexão(ões) não sincroniza(m) há mais de 24 horas:{' '}
              <strong>{staleItems.map(i => i.institution_name).join(', ')}</strong>
            </AlertDescription>
          </Alert>
        )}

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
                  <TableHead>Última Sincronização</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map(item => {
                  const sc = statusConfig[item.status] || statusConfig.pending;
                  const stale = isStale(item.last_sync_at);
                  return (
                    <TableRow key={item.id} className={stale && item.status !== 'error' ? 'bg-yellow-500/5' : ''}>
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
                      <TableCell>
                        <div>
                          <p className={`text-sm ${stale ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {getElapsedText(item.last_sync_at)}
                          </p>
                          {item.last_sync_at && (
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(item.last_sync_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                          {stale && (
                            <Badge variant="outline" className="mt-1 text-[10px] border-yellow-500 text-yellow-600">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                              +24h sem sync
                            </Badge>
                          )}
                        </div>
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
                          <Button 
                            size="sm" 
                            variant="default" 
                            onClick={() => triggerSync(item.id)}
                            disabled={syncingItemId === item.id}
                          >
                            {syncingItemId === item.id ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Forçar Sync
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedItemId(item.id)}>
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

        {/* Global Sync Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Sincronizações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {syncLogs?.slice(0, 30).map((log: any) => (
              <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {log.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                  {log.status !== 'success' && log.status !== 'failed' && <Clock className="h-4 w-4 text-yellow-500" />}
                  <div>
                    <p className="text-sm font-medium">
                      {log.open_finance_items?.institution_name || log.sync_type?.toUpperCase()} — {log.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getElapsedText(log.started_at)} · {new Date(log.started_at).toLocaleString('pt-BR')}
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

        {/* Details Dialog with per-item logs */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItemId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes — {selectedItem?.institution_name}</DialogTitle>
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
                    <p className="text-muted-foreground">Última Sync</p>
                    <p className="font-medium">{getElapsedText(selectedItem.last_sync_at)}</p>
                  </div>
                  {selectedItem.error_message && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Erro</p>
                      <p className="text-destructive text-sm">{selectedItem.error_message}</p>
                    </div>
                  )}
                </div>

                {/* Per-item sync logs */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Últimos 10 eventos de sync</h4>
                  <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                    {selectedItemLogs.length > 0 ? selectedItemLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between p-2 rounded border text-xs">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          ) : log.status === 'failed' ? (
                            <XCircle className="h-3 w-3 text-destructive shrink-0" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-500 shrink-0" />
                          )}
                          <span>{log.sync_type} — {log.status}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{log.records_imported}/{log.records_fetched}</span>
                          <span>{getElapsedText(log.started_at)}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-muted-foreground text-xs py-2">Nenhum log para esta conexão</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedItemId(null)}>Fechar</Button>
                  <Button 
                    onClick={() => { triggerSync(selectedItem.id); setSelectedItemId(null); }}
                    disabled={syncingItemId === selectedItem.id}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Forçar Sincronização
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
