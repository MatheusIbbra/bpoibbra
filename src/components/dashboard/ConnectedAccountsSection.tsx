import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Landmark,
  CreditCard,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBankConnections, useSyncBankConnection, BankConnection } from "@/hooks/useBankConnections";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PluggyAccountMeta {
  id: string;
  type: string;
  subtype?: string;
  name: string;
  number?: string | null;
  agency?: string | null;
  balance?: number | null;
  available_balance?: number | null;
  currency?: string;
}

interface ConnectionMetadata {
  bank_name?: string;
  bank_logo_url?: string | null;
  connector_name?: string | null;
  pluggy_accounts?: PluggyAccountMeta[];
  last_balance?: number;
  last_sync_accounts_count?: number;
}

function getAccountTypeIcon(type: string) {
  switch (type?.toUpperCase()) {
    case "CHECKING":
    case "BANK":
      return <Landmark className="h-4 w-4" />;
    case "CREDIT":
    case "CREDIT_CARD":
      return <CreditCard className="h-4 w-4" />;
    case "SAVINGS":
      return <PiggyBank className="h-4 w-4" />;
    case "INVESTMENT":
      return <TrendingUp className="h-4 w-4" />;
    default:
      return <Building2 className="h-4 w-4" />;
  }
}

function getAccountTypeLabel(type: string) {
  switch (type?.toUpperCase()) {
    case "CHECKING":
    case "BANK":
      return "Conta Corrente";
    case "CREDIT":
    case "CREDIT_CARD":
      return "Cartão de Crédito";
    case "SAVINGS":
      return "Poupança";
    case "INVESTMENT":
      return "Investimento";
    default:
      return "Conta";
  }
}

function maskAccountNumber(number: string | null | undefined): string {
  if (!number) return "••••";
  const clean = number.replace(/\D/g, "");
  if (clean.length <= 4) return `••${clean}`;
  return `••••${clean.slice(-4)}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-success/10 text-success border-success/20";
    case "syncing":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-destructive/10 text-destructive border-destructive/20";
  }
}

function getStatusDot(status: string) {
  switch (status) {
    case "active":
      return "bg-success";
    case "syncing":
      return "bg-warning animate-pulse";
    default:
      return "bg-destructive";
  }
}

export function ConnectedAccountsSection() {
  const { data: connections, isLoading } = useBankConnections();
  const syncConnection = useSyncBankConnection();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const activeConnections = connections?.filter(c => c.status === "active") || [];

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[140px] rounded-xl" />
        <Skeleton className="h-[140px] rounded-xl" />
      </div>
    );
  }

  if (activeConnections.length === 0) return null;

  const handleSync = async (connection: BankConnection) => {
    setSyncingId(connection.id);
    try {
      await syncConnection.mutateAsync({
        bankConnectionId: connection.id,
        itemId: connection.external_account_id || undefined,
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Contas Conectadas
        </h3>
      </div>
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {activeConnections.map((connection) => {
          const meta = (connection as any).metadata as ConnectionMetadata | null;
          const isSyncing = syncingId === connection.id;
          const pluggyAccounts = meta?.pluggy_accounts || [];
          const bankName = meta?.bank_name || connection.provider_name || "Banco";
          const bankLogo = meta?.bank_logo_url;
          const totalBalance = meta?.last_balance ?? null;

          return (
            <Card
              key={connection.id}
              className="card-executive-hover overflow-hidden"
            >
              <CardContent className="p-4">
                {/* Header: bank logo/name + status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {bankLogo ? (
                      <img
                        src={bankLogo}
                        alt={bankName}
                        className="h-8 w-8 rounded-lg object-contain bg-muted p-0.5"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold leading-tight">{bankName}</p>
                      {pluggyAccounts.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {pluggyAccounts[0].agency && `Ag. ${pluggyAccounts[0].agency} · `}
                          {maskAccountNumber(pluggyAccounts[0].number)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("h-2 w-2 rounded-full", getStatusDot(connection.status))} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleSync(connection)}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Balance */}
                {totalBalance !== null && (
                  <div className="mb-2">
                    <p className="text-[11px] text-muted-foreground">Saldo</p>
                    <p className="text-xl font-bold tracking-tight">
                      {formatCurrency(totalBalance)}
                    </p>
                  </div>
                )}

                {/* Sub-accounts list */}
                {pluggyAccounts.length > 1 && (
                  <div className="space-y-1 mb-2">
                    {pluggyAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {getAccountTypeIcon(acc.type)}
                          <span>{getAccountTypeLabel(acc.type)}</span>
                        </div>
                        <span className="font-medium">
                          {acc.balance !== null && acc.balance !== undefined
                            ? formatCurrency(acc.balance)
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Last sync */}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-auto pt-1 border-t border-border/50">
                  {connection.last_sync_at ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      <span>
                        Atualizado{" "}
                        {formatDistanceToNow(new Date(connection.last_sync_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      <span>Nunca sincronizado</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
