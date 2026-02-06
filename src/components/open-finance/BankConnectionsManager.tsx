import { useState, useEffect, useCallback } from "react";
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
  const [pluggyToken, setPluggyToken] = useState<string | null>(null);

  // Handle Pluggy widget success
  const handlePluggySuccess = useCallback(async (data: { item: { id: string }; connector?: { name?: string } }) => {
    const organizationId = getRequiredOrganizationId();
    if (!organizationId) return;

    try {
      // Save the item to database
      await savePluggyItem.mutateAsync({
        organizationId,
        itemId: data.item.id,
        connectorName: data.connector?.name
      });

      // Trigger sync
      await syncConnection.mutateAsync({
        organizationId,
        itemId: data.item.id
      });

      refetch();
    } catch (error) {
      console.error('Failed to save Pluggy item:', error);
    } finally {
      setPluggyToken(null);
      setIsConnecting(false);
    }
  }, [getRequiredOrganizationId, savePluggyItem, syncConnection, refetch]);

  // Handle Pluggy widget error
  const handlePluggyError = useCallback((error: { message?: string }) => {
    console.error('Pluggy error:', error);
    toast.error("Erro na conexão: " + (error.message || 'Erro desconhecido'));
    setPluggyToken(null);
    setIsConnecting(false);
  }, []);

  // Open Pluggy Connect widget in a popup to avoid iframe CORS blocking
  useEffect(() => {
    if (!pluggyToken) return;

    // Build a minimal HTML page for the popup that loads the Pluggy SDK
    const popupHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Conectando ao banco...</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .loading { text-align: center; color: #555; }
    .loading p { margin-top: 12px; font-size: 14px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #ddd; border-top-color: #333; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>Carregando widget de conexão bancária...</p>
  </div>
  <script src="https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js"><\/script>
  <script>
    try {
      var connect = new PluggyConnect({
        connectToken: '${pluggyToken}',
        onSuccess: function(itemData) {
          window.opener.postMessage({ type: 'pluggy-success', data: itemData }, '*');
          window.close();
        },
        onError: function(error) {
          window.opener.postMessage({ type: 'pluggy-error', error: error }, '*');
          window.close();
        },
        onClose: function() {
          window.opener.postMessage({ type: 'pluggy-close' }, '*');
          window.close();
        }
      });
      connect.init();
    } catch(e) {
      document.body.innerHTML = '<div class="loading"><p>Erro ao carregar widget: ' + e.message + '</p></div>';
      setTimeout(function() { window.close(); }, 3000);
    }
  <\/script>
</body>
</html>`;

    const blob = new Blob([popupHtml], { type: 'text/html' });
    const popupUrl = URL.createObjectURL(blob);
    
    const popup = window.open(
      popupUrl,
      'pluggy-connect',
      'width=500,height=700,scrollbars=yes,resizable=yes,left=200,top=100'
    );

    if (!popup) {
      toast.error('Popup bloqueado pelo navegador. Permita popups para este site.');
      setIsConnecting(false);
      setPluggyToken(null);
      URL.revokeObjectURL(popupUrl);
      return;
    }

    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type?.startsWith('pluggy-')) return;
      
      switch (event.data.type) {
        case 'pluggy-success':
          console.log('Pluggy success from popup:', event.data.data);
          handlePluggySuccess({ item: event.data.data, connector: event.data.data?.connector });
          break;
        case 'pluggy-error':
          console.error('Pluggy error from popup:', event.data.error);
          handlePluggyError(event.data.error || { message: 'Erro desconhecido' });
          break;
        case 'pluggy-close':
          console.log('Pluggy popup closed');
          setPluggyToken(null);
          setIsConnecting(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setPluggyToken(null);
        setIsConnecting(false);
      }
    }, 500);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(checkClosed);
      URL.revokeObjectURL(popupUrl);
    };
  }, [pluggyToken, handlePluggySuccess, handlePluggyError]);

  const handleConnect = async () => {
    const organizationId = getRequiredOrganizationId();
    if (!organizationId) return;

    setIsConnecting(true);
    
    try {
      const result = await openPluggyConnect.mutateAsync({ organizationId });
      if (result.accessToken) {
        setPluggyToken(result.accessToken);
      }
    } catch (error) {
      console.error("Failed to get connect token:", error);
      setIsConnecting(false);
    }
  };

  const handleFirstSync = async () => {
    const organizationId = getRequiredOrganizationId();
    if (!organizationId) return;

    setSyncingId('new');
    try {
      await syncConnection.mutateAsync({ organizationId });
      refetch();
    } finally {
      setSyncingId(null);
    }
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Open Finance
              </CardTitle>
              <CardDescription>
                Conecte suas contas bancárias via Open Finance
                {selectedOrganization && (
                  <span className="block mt-1 text-xs">
                    Base: {selectedOrganization.name}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleFirstSync}
                disabled={syncingId === 'new'}
              >
                {syncingId === 'new' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar
              </Button>
              <Button 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Conectar Conta Bancária
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
                Clique em "Conectar Conta Bancária" para conectar seu banco via Open Finance
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
              Isso irá desconectar o banco {selectedConnection?.provider_name || 'selecionado'}. 
              As transações já importadas serão mantidas, mas você não poderá sincronizar novas transações
              até reconectar.
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
  isSyncing: boolean;
  isDisconnecting: boolean;
}

function ConnectionCard({ connection, onSync, onDisconnect, isSyncing, isDisconnecting }: ConnectionCardProps) {
  const status = statusConfig[connection.status] || statusConfig.error;
  const StatusIcon = status.icon;
  const isActive = connection.status === 'active';

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{connection.provider_name || 'Banco via Open Finance'}</span>
            <Badge variant={status.variant} className="text-xs">
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
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
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={!isActive || isSyncing || isDisconnecting}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Sincronizar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          disabled={isSyncing || isDisconnecting}
          className="text-destructive hover:text-destructive"
        >
          {isDisconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Desconectar</span>
        </Button>
      </div>
    </div>
  );
}
