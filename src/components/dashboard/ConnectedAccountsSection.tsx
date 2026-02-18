import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

// Fallback logo URLs for common Brazilian banks (Pluggy CDN)
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

function isCreditCardType(type: string): boolean {
  return ["CREDIT", "CREDIT_CARD"].includes(type?.toUpperCase());
}

function maskAccountNumber(number: string | null | undefined): string {
  if (!number) return "••••";
  const clean = number.replace(/\D/g, "");
  if (clean.length <= 4) return `••${clean}`;
  return `••••${clean.slice(-4)}`;
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

export function ConnectedAccountsSection({ compact = false }: { compact?: boolean }) {
  const { data: connections, isLoading } = useBankConnections();
  const syncConnection = useSyncBankConnection();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Consolidate duplicate connections by bank name (same institution)
  const activeConnections = useMemo(() => {
    const raw = connections?.filter(c => c.status === "active") || [];
    const seen = new Map<string, BankConnection>();
    for (const conn of raw) {
      const meta = (conn as any).metadata as ConnectionMetadata | null;
      const bankName = (meta?.bank_name || conn.provider_name || "").toLowerCase().trim();
      const key = bankName || conn.id;
      // Keep the most recently updated one
      if (!seen.has(key) || new Date(conn.updated_at) > new Date(seen.get(key)!.updated_at)) {
        seen.set(key, conn);
      }
    }
    return Array.from(seen.values());
  }, [connections]);

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
      <div className={cn(
        "grid gap-3 grid-cols-1",
        compact ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3"
      )}>
        {activeConnections.map((connection) => {
          const meta = (connection as any).metadata as ConnectionMetadata | null;
          const isSyncing = syncingId === connection.id;
          const pluggyAccounts = meta?.pluggy_accounts || [];
          const bankName = meta?.bank_name || connection.provider_name || "Banco";
          const bankLogo = getBankLogoUrl(bankName, meta?.bank_logo_url);

          const bankAccounts = pluggyAccounts.filter(a => !isCreditCardType(a.type));
          const creditCards = pluggyAccounts.filter(a => isCreditCardType(a.type));
          const totalBalance = bankAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);

          return (
            <Card key={connection.id} className="card-executive-hover overflow-hidden">
              <CardContent className={compact ? "p-3" : "p-4"}>
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {bankLogo ? (
                      <img src={bankLogo} alt={bankName} className={cn("rounded-lg object-contain bg-muted p-0.5", compact ? "h-6 w-6" : "h-8 w-8")} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className={cn("rounded-lg bg-primary/10 flex items-center justify-center", compact ? "h-6 w-6" : "h-8 w-8")}>
                        <Building2 className={compact ? "h-3 w-3 text-primary" : "h-4 w-4 text-primary"} />
                      </div>
                    )}
                    <div>
                      <p className={cn("font-semibold leading-tight", compact ? "text-xs" : "text-sm")}>{bankName}</p>
                      {!compact && bankAccounts.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {bankAccounts[0].agency && `Ag. ${bankAccounts[0].agency} · `}{maskAccountNumber(bankAccounts[0].number)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn("h-2 w-2 rounded-full", getStatusDot(connection.status))} />
                    {!compact && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSync(connection)} disabled={isSyncing}>
                        {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Balance */}
                {bankAccounts.length > 0 && (
                  <div className={compact ? "mb-1" : "mb-2"}>
                    <p className="text-[11px] text-muted-foreground">Saldo</p>
                    <p className={cn("font-bold tracking-tight", compact ? "text-base" : "text-xl")}>{formatCurrency(totalBalance)}</p>
                  </div>
                )}

                {/* Sub-accounts — hide in compact */}
                {!compact && bankAccounts.length > 1 && (
                  <div className="space-y-1 mb-2">
                    {bankAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {getAccountTypeIcon(acc.type)}
                          <span>{getAccountTypeLabel(acc.type)}</span>
                        </div>
                        <span className="font-medium">{acc.balance != null ? formatCurrency(acc.balance) : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Credit cards — hide in compact */}
                {!compact && creditCards.length > 0 && (
                  <div className="space-y-1 mb-2 pt-2 border-t border-border/50">
                    {creditCards.map((acc) => {
                      const debt = Math.abs(acc.balance ?? 0);
                      const availableCredit = acc.available_balance ?? null;
                      return (
                        <div key={acc.id}>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CreditCard className="h-4 w-4" />
                              <span>{acc.name || "Cartão"}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-medium text-destructive">{formatCurrency(debt)}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">fatura</span>
                            </div>
                          </div>
                          {availableCredit !== null && (
                            <div className="flex justify-end text-[10px] text-muted-foreground mt-0.5">
                              Limite disponível: {formatCurrency(availableCredit)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Last sync */}
                <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground mt-auto pt-1 border-t border-border/50", compact && "pt-0.5")}>
                  {connection.last_sync_at ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      <span>
                        {compact ? "Sync " : "Atualizado "}
                        {formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: ptBR })}
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
