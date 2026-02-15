import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Wallet, Globe, ArrowRightLeft } from "lucide-react";
import { useConsolidatedBalance } from "@/hooks/useConsolidatedBalance";
import { formatCurrency, getCurrencySymbol } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

const FLAG_EMOJI: Record<string, string> = {
  BRL: "🇧🇷",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  CHF: "🇨🇭",
};

export function MultiCurrencyBalanceSection() {
  const { data, isLoading } = useConsolidatedBalance();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[140px] rounded-xl" />
      </div>
    );
  }

  if (!data || data.by_currency.length <= 1) return null;

  const hasMultipleCurrencies = data.by_currency.length > 1;
  if (!hasMultipleCurrencies) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Posição Multimoeda
        </h3>
      </div>

      <Card className="card-executive overflow-hidden">
        <CardContent className="p-5">
          {/* Consolidated total */}
          <div className="mb-4 pb-4 border-b border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Posição Consolidada ({data.target_currency})
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight">
              <MaskedValue>
                {formatCurrency(data.total_converted, data.target_currency)}
              </MaskedValue>
            </p>
          </div>

          {/* Per-currency breakdown */}
          <div className="space-y-3">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Detalhamento por Moeda
            </span>
            <div className="grid gap-2">
              {data.by_currency.map((cb) => (
                <div
                  key={cb.currency}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{FLAG_EMOJI[cb.currency] || "🏳️"}</span>
                    <div>
                      <span className="text-sm font-medium">{cb.currency}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        {cb.account_count} conta(s)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      <MaskedValue>
                        {formatCurrency(cb.balance, cb.currency)}
                      </MaskedValue>
                    </p>
                    {cb.currency !== data.target_currency && cb.converted_balance != null && (
                      <p className="text-[10px] text-muted-foreground">
                        ≈ <MaskedValue>{formatCurrency(cb.converted_balance, data.target_currency)}</MaskedValue>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exchange rates used */}
          {data.rates_used && data.rates_used.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Taxas Utilizadas
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.rates_used.map((r) => (
                  <Badge
                    key={`${r.from}-${r.to}`}
                    variant="secondary"
                    className="text-[10px] font-mono"
                  >
                    {r.from}/{r.to} → {r.rate.toFixed(4)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
