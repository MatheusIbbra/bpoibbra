import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  RefreshCw, 
  Unlink, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Plus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  useBankConnections, 
  useOpenPluggyConnect,
  useSyncBankConnection,
  useDisconnectBank,
  useSavePluggyItem,
  BankConnection
} from "@/hooks/useBankConnections";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<any> }> = {
  active: { label: "Ativo", variant: "default", icon: CheckCircle2 },
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  expired: { label: "Expirado", variant: "destructive", icon: AlertCircle },
  revoked: { label: "Revogado", variant: "destructive", icon: XCircle },
  disconnected: { label: "Desconectado", variant: "secondary", icon: Unlink },
  error: { label: "Erro", variant: "destructive", icon: AlertCircle },
};

export function BankConnectionsManager() {
  const { requiresBaseSelection, getRequiredOrganizationId, selectedOrganization } = useBaseFilter();
  const { data: connections, isLoading, refetch } = useBankConnections();
  const openPluggyConnect = useOpenPluggyConnect();
  const syncConnection = useSyncBankConnection();
  const disconnectBank = useDisconnectBank();
  const savePluggyItem = useSavePluggyItem();
  
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<BankConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Popup window ref
  const popupRef = useRef<Window | null>(null);
  const pendingOrgIdRef = useRef<string | null>(null);

  // Listen for messages from popup window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const { type, data, error } = event.data || {};
      
      if (type === 'pluggy-success' && data) {
        console.log("[OpenFinance] Popup success:", JSON.stringify(data));
        const orgId = pendingOrgIdRef.current;
        const itemId = data.item?.id || data.id;
        const connectorName = data.item?.connector?.name || data.connector?.name;

        if (!itemId || !orgId) {
          toast.error("Dados da conexão incompletos.");
          setIsConnecting(false);
          return;
        }

        try {
          toast.info("Salvando conexão bancária...");
          await savePluggyItem.mutateAsync({ organizationId: orgId, itemId, connectorName });
          toast.success("Conexão bancária salva!");
        } catch (err: any) {
          toast.error("Erro ao salvar conexão: " + (err?.message || 'Erro'));
          setIsConnecting(false);
          pendingOrgIdRef.current = null;
          return;
        }

        try {
          toast.info("Sincronizando transações...");
          const result = await syncConnection.mutateAsync({ organizationId: orgId, itemId });
          toast.success(`Sincronização concluída: ${result.imported} transações importadas`);
        } catch (err: any) {
          toast.warning("Conexão salva. Use 'Sincronizar' para importar transações.");
        }

        refetch();
        setIsConnecting(false);
        pendingOrgIdRef.current = null;
      } else if (type === 'pluggy-error') {
        console.error("[OpenFinance] Popup error:", error);
        const orgId = pendingOrgIdRef.current;
        const itemId = error?.data?.item?.id || error?.item?.id;

        // Partial error - try to save anyway
        if (itemId && orgId) {
          toast.warning("Erro parcial. Tentando salvar...");
          try {
            await savePluggyItem.mutateAsync({ organizationId: orgId, itemId });
            await syncConnection.mutateAsync({ organizationId: orgId, itemId });
            toast.success("Conexão salva com sucesso!");
          } catch {
            toast.warning("Conexão pode ter sido salva. Verifique e sincronize manualmente.");
          }
          refetch();
        } else {
          toast.error("Erro na conexão: " + (error?.message || 'Erro desconhecido'));
        }

        setIsConnecting(false);
        pendingOrgIdRef.current = null;
      } else if (type === 'pluggy-close') {
        console.log("[OpenFinance] Popup closed");
        setIsConnecting(false);
        pendingOrgIdRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [savePluggyItem, syncConnection, refetch]);

  const handleConnect = async () => {
    const organizationId = getRequiredOrganizationId();
    if (!organizationId) return;

    setIsConnecting(true);
    pendingOrgIdRef.current = organizationId;
    
    try {
      const result = await openPluggyConnect.mutateAsync({ organizationId });
      
      if (!result.accessToken) {
        toast.error("Token de conexão inválido.");
        setIsConnecting(false);
        return;
      }

      // Open popup window with the connect token
      const popupUrl = `/pluggy-connect.html#${result.accessToken}`;
      const popup = window.open(
        popupUrl,
        'pluggy-connect',
        'width=500,height=700,scrollbars=yes,resizable=yes,left=200,top=100'
      );

      if (!popup) {
        toast.error("Popup bloqueado pelo navegador. Permita popups para este site.");
        setIsConnecting(false);
        return;
      }

      popupRef.current = popup;

      // Monitor popup close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          // Only reset if still connecting (no success/error message received)
          setTimeout(() => {
            setIsConnecting(false);
            pendingOrgIdRef.current = null;
          }, 1000);
        }
      }, 500);

    } catch (error: any) {
      toast.error("Falha ao conectar: " + (error?.message || 'Erro desconhecido'));
      setIsConnecting(false);
    }
  };

  const handleSyncAll = async () => {
    const organizationId = getRequiredOrganizationId();
    if (!organizationId) return;

    const activeConns = connections?.filter(c => c.status === 'active') || [];
    
    if (activeConns.length === 0) {
      setSyncingId('all');
      try {
        await syncConnection.mutateAsync({ organizationId });
      } catch (err: any) {
        console.error("[SyncAll] Org-level sync failed:", err);
      } finally {
        setSyncingId(null);
        refetch();
      }
      return;
    }

    setSyncingId('all');
    let totalImported = 0;
    let errors = 0;

    for (const conn of activeConns) {
      try {
        const result = await syncConnection.mutateAsync({ 
          bankConnectionId: conn.id,
          itemId: conn.external_account_id || undefined
        });
        totalImported += result.imported || 0;
      } catch (err: any) {
        errors++;
        console.error(`[SyncAll] Failed to sync connection ${conn.id}:`, err);
      }
    }

    if (errors > 0) {
      toast.warning(`Sincronização concluída com ${errors} erro(s). ${totalImported} transações importadas.`);
    } else {
      toast.success(`Todas as contas sincronizadas: ${totalImported} transações importadas.`);
    }
    
    refetch();
    setSyncingId(null);
  };

  const handleSync = async (connectionId: string, itemId?: string | null) => {
    setSyncingId(connectionId);
    try {
      await syncConnection.mutateAsync({ 
        bankConnectionId: connectionId,
        itemId: itemId || undefined
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnectClick = (connection: BankConnection) => {
    setSelectedConnection(connection);
    setShowDisconnectDialog(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!selectedConnection) return;
    
    setDisconnectingId(selectedConnection.id);
    setShowDisconnectDialog(false);
    
    try {
      await disconnectBank.mutateAsync(selectedConnection.id);
    } finally {
      setDisconnectingId(null);
      setSelectedConnection(null);
    }
  };

  if (requiresBaseSelection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Open Finance
          </CardTitle>
          <CardDescription>
            Conecte suas contas bancárias via Open Finance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BaseRequiredAlert action="conectar um banco" />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Open Finance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activeConnections = connections?.filter(c => c.status === 'active') || [];
  const inactiveConnections = connections?.filter(c => c.status !== 'active') || [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Open Finance
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Conecte suas contas bancárias
                {selectedOrganization && (
                  <span className="block">Base: {selectedOrganization.name}</span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {activeConnections.length > 0 && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleSyncAll}
                  disabled={syncingId === 'all'}
                >
                  {syncingId === 'all' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  <span className="hidden sm:inline">Sincronizar Todas</span>
                  <span className="sm:hidden">Sync</span>
                </Button>
              )}
              <Button 
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                )}
                <span className="hidden sm:inline">Conectar Banco</span>
                <span className="sm:hidden">Conectar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connections?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma conexão bancária encontrada</p>
              <p className="text-sm mt-2">
                Clique em "Conectar Banco" para conectar via Open Finance
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeConnections.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Conexões Ativas</h4>
                  {activeConnections.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      onSync={() => handleSync(connection.id, connection.external_account_id)}
                      onDisconnect={() => handleDisconnectClick(connection)}
                      onReconnect={handleConnect}
                      isSyncing={syncingId === connection.id}
                      isDisconnecting={disconnectingId === connection.id}
                    />
                  ))}
                </div>
              )}
              {inactiveConnections.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Conexões Inativas / Desconectadas</h4>
                  {inactiveConnections.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      onSync={() => handleSync(connection.id, connection.external_account_id)}
                      onDisconnect={() => handleDisconnectClick(connection)}
                      onReconnect={handleConnect}
                      isSyncing={syncingId === connection.id}
                      isDisconnecting={disconnectingId === connection.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar banco?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desconectar o banco {selectedConnection?.provider_name || 'selecionado'},
              <strong> excluir a conta e todas as movimentações vinculadas</strong>. 
              Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnectConfirm} className="bg-destructive text-destructive-foreground">
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ConnectionCardProps {
  connection: BankConnection;
  onSync: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  isSyncing: boolean;
  isDisconnecting: boolean;
}

function ConnectionCard({ connection, onSync, onDisconnect, onReconnect, isSyncing, isDisconnecting }: ConnectionCardProps) {
  const status = statusConfig[connection.status] || statusConfig.error;
  const StatusIcon = status.icon;
  const isActive = connection.status === 'active';

  interface ConnectionMeta {
    bank_name?: string;
    bank_logo_url?: string | null;
    pluggy_accounts?: Array<{
      id: string;
      type: string;
      name: string;
      balance: number | null;
      available_balance: number | null;
    }>;
    last_balance?: number;
    last_sync_accounts_count?: number;
    item_status?: string;
  }

  const meta = (connection as any).metadata as ConnectionMeta | null;
  const bankName = meta?.bank_name || connection.provider_name || 'Banco via Open Finance';
  const bankLogo = meta?.bank_logo_url;
  const pluggyAccounts = meta?.pluggy_accounts || [];
  const totalBalance = meta?.last_balance ?? null;
  const itemStatus = meta?.item_status;
  const hasLoginError = itemStatus === 'LOGIN_ERROR' || itemStatus === 'OUTDATED';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 border rounded-lg bg-card">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {bankLogo ? (
            <img
              src={bankLogo}
              alt={bankName}
              className="h-10 w-10 rounded-lg object-contain bg-muted p-0.5"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{bankName}</span>
              <Badge variant={status.variant} className="text-xs">
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              {hasLoginError && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Requer reconexão
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {connection.last_sync_at ? (
                <>
                  Última sincronização:{" "}
                  {formatDistanceToNow(new Date(connection.last_sync_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </>
              ) : (
                "Nunca sincronizado"
              )}
            </div>
            {connection.sync_error && (
              <div className="text-xs text-destructive mt-1">
                Erro: {connection.sync_error}
              </div>
            )}
            {hasLoginError && (
              <div className="text-xs text-destructive mt-1">
                O consentimento expirou ou houve erro de login. Desconecte e reconecte o banco.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {totalBalance !== null && !hasLoginError && (
            <div className="text-right mr-2">
              <div className="text-xs text-muted-foreground">Saldo Total</div>
              <div className={`text-sm font-semibold ${totalBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(totalBalance)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account details */}
      {pluggyAccounts.length > 0 && !hasLoginError && (
        <div className="border-t pt-2 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Contas vinculadas</div>
          <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2">
            {pluggyAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
                <span className="truncate">{acc.name || acc.type}</span>
                <span className={`font-medium ${(acc.balance ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {acc.balance !== null ? formatCurrency(acc.balance) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end border-t pt-2">
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing || isDisconnecting}
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">Sincronizar</span>
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onReconnect}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Reconectar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          disabled={isSyncing || isDisconnecting}
          className="text-destructive hover:text-destructive"
        >
          {isDisconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlink className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
