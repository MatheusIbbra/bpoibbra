import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Building2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useBankConnections, useSyncBankConnection, BankConnection } from "@/hooks/useBankConnections";
import { useAutoIgnoreTransfers } from "@/hooks/useAutoIgnoreTransfers";
import { cn } from "@/lib/utils";

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

interface ConnectionMetadata {
  bank_name?: string;
  bank_logo_url?: string | null;
  connector_name?: string | null;
  pluggy_accounts?: any[];
  last_balance?: number;
  last_sync_accounts_count?: number;
}

export function ConnectedAccountsSection({ compact = false }: { compact?: boolean }) {
  const { data: connections, isLoading } = useBankConnections();
  const syncConnection = useSyncBankConnection();
  const autoIgnoreTransfers = useAutoIgnoreTransfers();
  const [syncingAll, setSyncingAll] = useState(false);

  const activeConnections = useMemo(() => {
    const raw = connections?.filter(c => c.status === "active") || [];
    const seen = new Map<string, BankConnection>();
    for (const conn of raw) {
      const meta = (conn as any).metadata as ConnectionMetadata | null;
      const bankName = (meta?.bank_name || conn.provider_name || "").toLowerCase().trim();
      const key = bankName || conn.id;
      if (!seen.has(key) || new Date(conn.updated_at) > new Date(seen.get(key)!.updated_at)) {
        seen.set(key, conn);
      }
    }
    return Array.from(seen.values());
  }, [connections]);

  if (isLoading) {
    return <Skeleton className="h-10 rounded-xl" />;
  }

  if (activeConnections.length === 0) return null;

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      for (const conn of activeConnections) {
        await syncConnection.mutateAsync({
          bankConnectionId: conn.id,
          itemId: conn.external_account_id || undefined,
        });
      }
      // After all syncs, detect internal transfers
      if (activeConnections.length > 0) {
        const orgId = activeConnections[0].organization_id;
        try {
          await autoIgnoreTransfers.mutateAsync(orgId);
        } catch (e) {
          console.warn('Auto-ignore transfers failed:', e);
        }
      }
    } finally {
      setSyncingAll(false);
    }
  };

  // Compact mode: just bank icons + sync button
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold shrink-0">Conectadas</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {activeConnections.map((connection) => {
            const meta = (connection as any).metadata as ConnectionMetadata | null;
            const bankName = meta?.bank_name || connection.provider_name || "Banco";
            const bankLogo = getBankLogoUrl(bankName, meta?.bank_logo_url);

            return (
              <Tooltip key={connection.id}>
                <TooltipTrigger asChild>
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/50">
                    {bankLogo ? (
                      <img
                        src={bankLogo}
                        alt={bankName}
                        className="h-5 w-5 rounded object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {bankName}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={handleSyncAll}
          disabled={syncingAll}
        >
          {syncingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Sincronizar
        </Button>
      </div>
    );
  }

  // Full mode - keep original behavior but simplified
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Contas Conectadas
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleSyncAll}
          disabled={syncingAll}
        >
          {syncingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Sincronizar Todas
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {activeConnections.map((connection) => {
          const meta = (connection as any).metadata as ConnectionMetadata | null;
          const bankName = meta?.bank_name || connection.provider_name || "Banco";
          const bankLogo = getBankLogoUrl(bankName, meta?.bank_logo_url);

          return (
            <Tooltip key={connection.id}>
              <TooltipTrigger asChild>
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center border border-border/50 hover:border-primary/30 transition-colors">
                  {bankLogo ? (
                    <img
                      src={bankLogo}
                      alt={bankName}
                      className="h-7 w-7 rounded-lg object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {bankName}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
