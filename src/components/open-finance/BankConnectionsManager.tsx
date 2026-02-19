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

const BANK_LOGO_FALLBACKS: Record<string, string> = {
  "itaú": "https://cdn.pluggy.ai/assets/connector-icons/201.svg",
  "itau": "https://cdn.pluggy.ai/assets/connector-icons/201.svg",
  "bradesco": "https://cdn.pluggy.ai/assets/connector-icons/202.svg",
  "banco do brasil": "https://cdn.pluggy.ai/assets/connector-icons/001.svg",
  "caixa": "https://cdn.pluggy.ai/assets/connector-icons/104.svg",
  "santander": "https://cdn.pluggy.ai/assets/connector-icons/033.svg",
  "nubank": "https://cdn.pluggy.ai/assets/connector-icons/260.svg",
  "inter": "https://cdn.pluggy.ai/assets/connector-icons/077.svg",
  "c6": "https://cdn.pluggy.ai/assets/connector-icons/336.svg",
  "btg": "https://cdn.pluggy.ai/assets/connector-icons/208.svg",
  "safra": "https://cdn.pluggy.ai/assets/connector-icons/422.svg",
  "xp": "https://cdn.pluggy.ai/assets/connector-icons/102.svg",
};

function getBankLogoUrl(bankName: string, metaLogoUrl?: string | null): string | null {
  if (metaLogoUrl) return metaLogoUrl;
  const normalized = bankName.toLowerCase().trim();
  for (const [key, url] of Object.entries(BANK_LOGO_FALLBACKS)) {
    if (normalized.includes(key)) return url;
  }
  return null;
}

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

  // Track if we already handled the success to prevent double processing
  const handledRef = useRef(false);

  // Listen for messages from popup window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const { type, data, error } = event.data || {};
      
      if (type === 'pluggy-success' && data) {
        // Prevent double processing
        if (handledRef.current) return;
        handledRef.current = true;

        console.log("[OpenFinance] Popup success:", JSON.stringify(data));
        const orgId = pendingOrgIdRef.current;
        
        // Extract item ID from various possible structures
        const itemId = data?.item?.id || data?.id || data?.itemId || 
                       (typeof data === 'string' ? data : null);
        const connectorName = data?.item?.connector?.name || data?.connector?.name || 
                              data?.item?.connectorName || data?.connectorName;

        console.log("[OpenFinance] Extracted itemId:", itemId, "orgId:", orgId, "connectorName:", connectorName);

        if (!itemId) {
          console.error("[OpenFinance] Could not extract itemId from data:", JSON.stringify(data));
          toast.error("Não foi possível identificar o item de conexão. Tente novamente.");
          setIsConnecting(false);
          handledRef.current = false;
          return;
        }

        if (!orgId) {
          console.error("[OpenFinance] No orgId in pendingOrgIdRef");
          toast.error("Sessão expirada. Tente conectar novamente.");
          setIsConnecting(false);
          handledRef.current = false;
          return;
        }

        try {
          toast.info("Salvando conexão bancária...");
          await savePluggyItem.mutateAsync({ organizationId: orgId, itemId, connectorName });
        } catch (err: any) {
          console.error("[OpenFinance] Save error:", err);
          toast.error("Erro ao salvar conexão: " + (err?.message || 'Erro'));
          setIsConnecting(false);
          pendingOrgIdRef.current = null;
          handledRef.current = false;
          return;
        }

        try {
          toast.info("Sincronizando transações... Aguarde até 60 segundos.");
          const result = await syncConnection.mutateAsync({ organizationId: orgId, itemId });
          if (result.imported > 0) {
            toast.success(`Sincronização concluída: ${result.imported} transações importadas, ${result.accounts || 0} contas`);
          } else {
            toast.info(`Contas sincronizadas (${result.accounts || 0}). Use 'Sincronizar' novamente se as transações não aparecerem imediatamente.`);
          }
        } catch (err: any) {
          console.warn("[OpenFinance] Sync error (connection saved):", err);
          toast.warning("Conexão salva. Clique em 'Sincronizar' para importar transações.");
        }

        refetch();
        setIsConnecting(false);
        pendingOrgIdRef.current = null;
        handledRef.current = false;
      } else if (type === 'pluggy-error') {
        console.error("[OpenFinance] Popup error:", JSON.stringify(error));
        const orgId = pendingOrgIdRef.current;
        const itemId = error?.data?.item?.id || error?.item?.id || error?.itemId;
        const errorMsg = error?.message || error?.msg || 'Erro desconhecido';

        // Partial error - try to save anyway if we have an item
        if (itemId && orgId) {
          toast.warning("Erro parcial na conexão. Tentando salvar...");
          try {
            await savePluggyItem.mutateAsync({ organizationId: orgId, itemId });
            toast.info("Conexão salva. Use 'Sincronizar' para importar transações.");
          } catch {
            toast.warning("Não foi possível salvar. Tente conectar novamente.");
          }
          refetch();
        } else {
          toast.error("Erro na conexão: " + errorMsg);
        }

        setIsConnecting(false);
        pendingOrgIdRef.current = null;
        handledRef.current = false;
      } else if (type === 'pluggy-close') {
        console.log("[OpenFinance] Popup closed by user");
        // Don't clear orgId immediately - success message might still arrive
        setTimeout(() => {
          setIsConnecting(false);
          pendingOrgIdRef.current = null;
          handledRef.current = false;
        }, 2000);
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

      // Monitor popup close - give enough time for the success message to be processed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          // Wait longer before clearing - success message may still be in flight
          setTimeout(() => {
            if (!handledRef.current) {
              // Only reset if no success/error was handled
              console.log("[OpenFinance] Popup closed without success handler firing");
              setIsConnecting(false);
              pendingOrgIdRef.current = null;
            }
          }, 3000);
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

    const allConns = connections?.filter(c => c.external_account_id) || [];
    
    if (allConns.length === 0) {
      setSyncingId('all');
      toast.info("Nenhuma conexão com item Pluggy vinculado. Conecte um banco primeiro.");
      setSyncingId(null);
      return;
    }

    setSyncingId('all');
    toast.info(`Sincronizando ${allConns.length} conexão(ões)... Isso pode levar alguns minutos.`);
    
    let totalImported = 0;
    let totalAccounts = 0;
    let errors = 0;

    for (const conn of allConns) {
      try {
        const result = await syncConnection.mutateAsync({ 
          bankConnectionId: conn.id,
          organizationId,
          itemId: conn.external_account_id || undefined
        });
        totalImported += result.imported || 0;
        totalAccounts += result.accounts || 0;
      } catch (err: any) {
        errors++;
        console.error(`[SyncAll] Failed to sync connection ${conn.id}:`, err);
      }
    }

    if (errors > 0) {
      toast.warning(`Sincronização concluída com ${errors} erro(s). ${totalImported} transações importadas.`);
    } else if (totalImported > 0) {
      toast.success(`Todas as contas sincronizadas: ${totalImported} transações importadas, ${totalAccounts} contas atualizadas.`);
    } else {
      toast.info(`Saldos atualizados (${totalAccounts} contas). Nenhuma transação nova.`);
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
  // Hide disconnected accounts - only show non-active that are not disconnected
  const inactiveConnections = connections?.filter(c => c.status !== 'active' && c.status !== 'disconnected') || [];

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
              {connections && connections.some(c => c.external_account_id) && (
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
  const bankLogo = getBankLogoUrl(bankName, meta?.bank_logo_url);
  const pluggyAccounts = meta?.pluggy_accounts || [];
  const totalBalance = meta?.last_balance ?? null;
  const itemStatus = meta?.item_status;
  const hasLoginError = itemStatus === 'LOGIN_ERROR' || itemStatus === 'OUTDATED';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 border rounded-lg bg-card">
      <div className="flex items-center gap-2.5">
        {bankLogo ? (
          <img
            src={bankLogo}
            alt={bankName}
            className="h-8 w-8 rounded-lg object-contain bg-muted p-0.5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium">{bankName}</span>
            <Badge variant={status.variant} className="text-[10px] h-4 px-1.5">
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {status.label}
            </Badge>
            {hasLoginError && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                Reconectar
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {connection.last_sync_at ? (
              <>Sync: {formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: ptBR })}</>
            ) : "Nunca sincronizado"}
          </div>
        </div>

        {totalBalance !== null && !hasLoginError && (
          <div className="text-right shrink-0">
            <div className={`text-sm font-semibold ${totalBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(totalBalance)}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {isActive ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSync} disabled={isSyncing || isDisconnecting}>
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReconnect}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDisconnect} disabled={isSyncing || isDisconnecting}>
            {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {connection.sync_error && (
        <p className="text-[10px] text-destructive px-1">Erro: {connection.sync_error}</p>
      )}

      {/* Compact account details */}
      {pluggyAccounts.length > 0 && !hasLoginError && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {pluggyAccounts.map((acc) => (
            <div key={acc.id} className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-muted/50">
              <span className="truncate max-w-[100px]">{acc.name || acc.type}</span>
              <span className={`font-medium ${(acc.balance ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {acc.balance !== null ? formatCurrency(acc.balance) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
