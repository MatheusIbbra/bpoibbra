import { CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCreditCardSummary } from "@/hooks/useCreditCardSummary";
import { useBankConnections } from "@/hooks/useBankConnections";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function getUsageStatus(percentage: number) {
  if (percentage >= 90) return { color: "text-destructive", barColor: "bg-destructive", label: "Crítico" };
  if (percentage >= 70) return { color: "text-warning", barColor: "bg-warning", label: "Atenção" };
  return { color: "text-success", barColor: "bg-success", label: "OK" };
}

export function CreditCardSummary() {
  const { data: cards, isLoading } = useCreditCardSummary();
  const { data: bankConnections } = useBankConnections();

  // Build bank logo map
  const bankLogoMap = new Map<string, string>();
  bankConnections?.forEach((conn) => {
    const meta = (conn as any).metadata as { bank_name?: string; bank_logo_url?: string | null } | null;
    if (meta?.bank_name && meta?.bank_logo_url) {
      bankLogoMap.set(meta.bank_name, meta.bank_logo_url);
    }
  });

  if (isLoading || !cards || cards.length === 0) return null;

  const totalDebt = cards.reduce((sum, c) => sum + Math.abs(c.currentBalance), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Cartões de Crédito
        </h3>
        <span className="text-xs text-destructive font-medium">
          Total a pagar: {formatCurrency(totalDebt)}
        </span>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const logo = card.bankName ? bankLogoMap.get(card.bankName) : undefined;
          const debt = Math.abs(card.currentBalance);
          
          // Estimate limit usage if we have data
          // available_balance on credit cards from Pluggy = available credit
          const hasLimitInfo = card.monthlyPurchases > 0 || debt > 0;
          const estimatedLimit = debt + (card.monthlyPayments || 0);
          const usagePercent = estimatedLimit > 0
            ? Math.min(100, Math.round((debt / Math.max(estimatedLimit, debt)) * 100))
            : 0;
          const status = getUsageStatus(usagePercent);

          return (
            <Card key={card.accountId} className="card-executive-hover overflow-hidden">
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-3">
                  {logo ? (
                    <img
                      src={logo}
                      alt={card.bankName || ""}
                      className="h-8 w-8 rounded-lg object-contain bg-muted p-0.5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{card.accountName}</p>
                    {card.bankName && (
                      <p className="text-[11px] text-muted-foreground">{card.bankName}</p>
                    )}
                  </div>
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", {
                    "bg-success/10 text-success border-success/20": usagePercent < 70,
                    "bg-warning/10 text-warning border-warning/20": usagePercent >= 70 && usagePercent < 90,
                    "bg-destructive/10 text-destructive border-destructive/20": usagePercent >= 90,
                  })}>
                    {status.label}
                  </span>
                </div>

                {/* Fatura atual */}
                <div className="mb-3">
                  <p className="text-[11px] text-muted-foreground">Fatura Atual</p>
                  <p className="text-xl font-bold tracking-tight text-destructive">
                    {formatCurrency(debt)}
                  </p>
                </div>

                {/* Usage bar */}
                {hasLimitInfo && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Limite utilizado</span>
                      <span className={cn("font-medium", status.color)}>{usagePercent}%</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full transition-all", status.barColor)}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Monthly breakdown */}
                <div className="flex items-center gap-3 text-[11px] pt-2 border-t border-border/50">
                  <div>
                    <span className="text-muted-foreground">Compras: </span>
                    <span className="font-medium">{formatCurrency(card.monthlyPurchases)}</span>
                  </div>
                  {card.monthlyPayments > 0 && (
                    <div>
                      <span className="text-muted-foreground">Pago: </span>
                      <span className="font-medium text-success">{formatCurrency(card.monthlyPayments)}</span>
                    </div>
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
