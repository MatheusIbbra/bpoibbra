import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  RefreshCw, 
  Unlink, 
  Plus, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  useBankConnections, 
  useOpenWhiteLabelConnection, 
  useSyncBankConnection,
  useDisconnectBank,
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
  error: { label: "Erro", variant: "destructive", icon: AlertCircle },
};

// WhiteLabel URL from Klavi (Basic Links)
const WHITELABEL_URL = "https://open-sandbox.klavi.ai/data/v1/basic-links/CB71gRISGm";

export function BankConnectionsManager() {
  const { requiresBaseSelection, getRequiredOrganizationId, selectedOrganization } = useBaseFilter();
  const { data: connections, isLoading, refetch } = useBankConnections();
  const openWhiteLabel = useOpenWhiteLabelConnection();
  const syncConnection = useSyncBankConnection();
  const disconnectBank = useDisconnectBank();
  
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<BankConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if user is returning from WhiteLabel authorization
  useEffect(() => {
    const pendingOrg = localStorage.getItem('pending_openfinance_org');
    const returnPath = localStorage.getItem('pending_openfinance_return');
    
    if (pendingOrg && window.location.pathname.includes('/open-finance')) {
      // Clear the pending state
      localStorage.removeItem('pending_openfinance_org');
      localStorage.removeItem('pending_openfinance_return');
      
      // Trigger a sync to check for new connections/transactions
      toast.info("Verificando conexão bancária...");
      
      // Refetch connections after a short delay
      setTimeout(() => {
        refetch();
      }, 1000);
    }
  }, [refetch]);

  const handleConnect = async () => {
    const organizationId = getRequiredOrganizationId();
    if (!organizationId) return;

    setIsConnecting(true);
    
    try {
      // Store organization context before redirecting
      localStorage.setItem('pending_openfinance_org', organizationId);
      localStorage.setItem('pending_openfinance_return', window.location.pathname);
      
      // Open WhiteLabel URL in a new tab (user will authorize there)
      window.open(WHITELABEL_URL, '_blank');
      
      toast.info(
        "Autorize o acesso no Open Finance e depois clique em 'Sincronizar' para importar suas transações.",
        { duration: 8000 }
      );
    } catch (error) {
      console.error("Failed to initiate connection:", error);
      toast.error("Erro ao iniciar conexão");
    } finally {
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

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId);
    try {
      await syncConnection.mutateAsync({ bankConnectionId: connectionId });
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
                  <ExternalLink className="h-4 w-4 mr-2" />
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
                1. Clique em "Conectar Conta Bancária" para autorizar<br />
                2. Depois clique em "Sincronizar" para importar as transações
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
                      onSync={() => handleSync(connection.id)}
                      onDisconnect={() => handleDisconnectClick(connection)}
                      isSyncing={syncingId === connection.id}
                      isDisconnecting={disconnectingId === connection.id}
                    />
                  ))}
                </div>
              )}
              
              {inactiveConnections.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Conexões Inativas</h4>
                  {inactiveConnections.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      onSync={() => handleSync(connection.id)}
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
              Isso irá revogar o acesso ao banco {selectedConnection?.provider_name || 'selecionado'}. 
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
